import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../l10n/strings.dart';
import '../theme/atlas_theme.dart';

/// لوحة توقيع حقيقية باللمس؛ تُصدَّر كصورة PNG مصغّرة (data URL) تُحفظ دليلاً للحيازة/التسليم
class SignaturePad extends StatefulWidget {
  final ValueChanged<String?> onChanged;
  const SignaturePad({super.key, required this.onChanged});
  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class _SignaturePadState extends State<SignaturePad> {
  final _strokes = <List<Offset>>[];
  Size _size = Size.zero;
  Future<void> _export() async {
    if (_strokes.isEmpty) { widget.onChanged(null); return; }
    final rec = ui.PictureRecorder(); final c = Canvas(rec); const w = 240.0; final k = w / _size.width;
    c.drawRect(Rect.fromLTWH(0, 0, w, _size.height * k), Paint()..color = Colors.white);
    final pen = Paint()..color = const Color(0xFF173B4D)..strokeWidth = 2.2..style = PaintingStyle.stroke..strokeCap = StrokeCap.round;
    for (final s in _strokes) { final p = Path(); for (var i = 0; i < s.length; i++) { final o = s[i] * k; i == 0 ? p.moveTo(o.dx, o.dy) : p.lineTo(o.dx, o.dy); } c.drawPath(p, pen); }
    final img = await rec.endRecording().toImage(w.toInt(), (_size.height * k).toInt());
    final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
    widget.onChanged('data:image/png;base64,${base64Encode(bytes!.buffer.asUint8List())}');
  }
  @override
  Widget build(BuildContext context) {
    final s = S(Localizations.localeOf(context).languageCode); final c = AtlasColors.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Semantics(
        label: s.t('لوحة التوقيع — ارسم توقيعك بإصبعك', 'Signature pad — draw your signature'),
        child: LayoutBuilder(builder: (_, b) { _size = Size(b.maxWidth, 140); return GestureDetector(
          onPanStart: (d) => setState(() => _strokes.add([d.localPosition])),
          onPanUpdate: (d) => setState(() => _strokes.last.add(d.localPosition)),
          onPanEnd: (_) => _export(),
          child: Container(height: 140, decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(18), border: Border.all(color: c.line)), child: CustomPaint(painter: _SigPainter(_strokes, Theme.of(context).colorScheme.onSurface))),
        ); }),
      ),
      Row(children: [Text(_strokes.isEmpty ? s.t('وقّع داخل الإطار', 'Sign inside the box') : s.t('تم التوقيع', 'Signed'), style: TextStyle(color: c.muted, fontSize: 12)), const Spacer(), TextButton(onPressed: () { setState(_strokes.clear); widget.onChanged(null); }, child: Text(s.t('مسح', 'Clear')))]),
    ]);
  }
}

class _SigPainter extends CustomPainter {
  final List<List<Offset>> strokes; final Color color;
  _SigPainter(this.strokes, this.color);
  @override
  void paint(Canvas c, Size size) { final pen = Paint()..color = color..strokeWidth = 2.4..style = PaintingStyle.stroke..strokeCap = StrokeCap.round; for (final s in strokes) { final p = Path(); for (var i = 0; i < s.length; i++) { i == 0 ? p.moveTo(s[i].dx, s[i].dy) : p.lineTo(s[i].dx, s[i].dy); } c.drawPath(p, pen); } }
  @override
  bool shouldRepaint(_SigPainter o) => true;
}
