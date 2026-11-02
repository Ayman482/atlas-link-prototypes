import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'tokens.dart';

/// سمة Emerald Health لتطبيقي Flutter — مبنية بالكامل من AtlasTokens (المولّدة من packages/tokens/tokens.json).
class AtlasTheme {
  static const _body = 'packages/atlas_shared/NotoSansArabic';
  static const _display = 'packages/atlas_shared/Alexandria';

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness b) {
    final p = b == Brightness.light ? AtlasTokens.light : AtlasTokens.dark;
    final scheme = ColorScheme(
      brightness: b,
      primary: p.primary,
      onPrimary: p.onPrimary,
      primaryContainer: p.primarySoft,
      onPrimaryContainer: p.primaryText,
      secondary: p.navy,
      onSecondary: p.onNavy,
      tertiary: p.gold,
      onTertiary: p.navy,
      error: p.critical,
      onError: Colors.white,
      errorContainer: p.criticalSoft,
      onErrorContainer: p.critical,
      surface: p.surface,
      onSurface: p.fg,
      onSurfaceVariant: p.muted,
      surfaceContainerHighest: p.sunk,
      outline: p.line2,
      outlineVariant: p.line,
    );
    final text = Typography.material2021(platform: TargetPlatform.android).black.apply(fontFamily: _body, bodyColor: p.fg, displayColor: p.fg);
    TextStyle? disp(TextStyle? s) => s?.copyWith(fontFamily: _display, fontWeight: FontWeight.w500, color: p.fg);
    final radius = BorderRadius.circular(AtlasTokens.radiusMd);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: p.bg,
      fontFamily: _body,
      textTheme: text.copyWith(
        displaySmall: disp(text.displaySmall),
        headlineMedium: disp(text.headlineMedium),
        headlineSmall: disp(text.headlineSmall),
        titleLarge: disp(text.titleLarge),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(backgroundColor: p.bg, foregroundColor: p.fg, elevation: 0, scrolledUnderElevation: 0, titleTextStyle: TextStyle(fontFamily: _display, fontSize: 20, fontWeight: FontWeight.w500, color: p.fg)),
      cardTheme: CardThemeData(color: p.surface, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AtlasTokens.radiusLg), side: BorderSide(color: p.line))),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(AtlasTokens.touchMin, AtlasTokens.touchMin), shape: RoundedRectangleBorder(borderRadius: radius), textStyle: const TextStyle(fontFamily: _body, fontWeight: FontWeight.w600, fontSize: 15))),
      outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(AtlasTokens.touchMin, AtlasTokens.touchMin), foregroundColor: p.fg, side: BorderSide(color: p.line2), shape: RoundedRectangleBorder(borderRadius: radius))),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(minimumSize: const Size(AtlasTokens.touchMin, AtlasTokens.touchMin), foregroundColor: p.primaryText)),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surface,
        border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.line2)),
        enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.line2)),
        focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.focus, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: p.critical)),
        labelStyle: TextStyle(color: p.muted),
      ),
      chipTheme: ChipThemeData(backgroundColor: p.sunk, selectedColor: p.primarySoft, labelStyle: TextStyle(color: p.fg, fontFamily: _body), shape: const StadiumBorder(), side: BorderSide(color: p.line)),
      navigationBarTheme: NavigationBarThemeData(backgroundColor: p.surface, indicatorColor: p.primarySoft, height: 68, labelTextStyle: WidgetStatePropertyAll(TextStyle(fontFamily: _body, fontSize: 12, color: p.fg))),
      snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: p.navy, contentTextStyle: TextStyle(color: p.onNavy, fontFamily: _body), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AtlasTokens.radiusMd))),
      dividerTheme: DividerThemeData(color: p.line, space: 1),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
      extensions: [AtlasColors(p.success, p.successSoft, p.warning, p.warningSoft, p.critical, p.criticalSoft, p.info, p.infoSoft, p.muted, p.goldText, p.goldSoft, p.navy, p.line)],
    );
  }
}

/// ألوان دلالية إضافية متاحة عبر `Theme.of(context).extension<AtlasColors>()`
class AtlasColors extends ThemeExtension<AtlasColors> {
  final Color success, successSoft, warning, warningSoft, critical, criticalSoft, info, infoSoft, muted, goldText, goldSoft, navy, line;
  const AtlasColors(this.success, this.successSoft, this.warning, this.warningSoft, this.critical, this.criticalSoft, this.info, this.infoSoft, this.muted, this.goldText, this.goldSoft, this.navy, this.line);
  static AtlasColors of(BuildContext c) => Theme.of(c).extension<AtlasColors>()!;
  @override
  AtlasColors copyWith() => this;
  @override
  AtlasColors lerp(ThemeExtension<AtlasColors>? other, double t) => other is AtlasColors && t > .5 ? other : this;
}
