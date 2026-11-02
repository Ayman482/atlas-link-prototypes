// مولَّد آلياً من packages/tokens/tokens.json — لا تعدّله يدوياً
import 'package:flutter/material.dart';

class _Palette {
  final Color bg;
  final Color bg2;
  final Color surface;
  final Color sunk;
  final Color raise;
  final Color line;
  final Color line2;
  final Color fg;
  final Color muted;
  final Color faint;
  final Color primary;
  final Color primaryHover;
  final Color primaryText;
  final Color onPrimary;
  final Color primarySoft;
  final Color navy;
  final Color onNavy;
  final Color gold;
  final Color goldText;
  final Color goldSoft;
  final Color success;
  final Color successSoft;
  final Color warning;
  final Color warningSoft;
  final Color critical;
  final Color criticalSoft;
  final Color info;
  final Color infoSoft;
  final Color focus;
  const _Palette({required this.bg, required this.bg2, required this.surface, required this.sunk, required this.raise, required this.line, required this.line2, required this.fg, required this.muted, required this.faint, required this.primary, required this.primaryHover, required this.primaryText, required this.onPrimary, required this.primarySoft, required this.navy, required this.onNavy, required this.gold, required this.goldText, required this.goldSoft, required this.success, required this.successSoft, required this.warning, required this.warningSoft, required this.critical, required this.criticalSoft, required this.info, required this.infoSoft, required this.focus});
}

class AtlasTokens {
  static const light = _Palette(
    bg: Color(0xFFF4FAF8),
    bg2: Color(0xFFE9F4F0),
    surface: Color(0xFFFFFFFF),
    sunk: Color(0xFFEAF4F0),
    raise: Color(0xFFF7FBFA),
    line: Color(0xFFD3E5DF),
    line2: Color(0xFFB4CFC6),
    fg: Color(0xFF173B4D),
    muted: Color(0xFF4D6672),
    faint: Color(0xFF7A909A),
    primary: Color(0xFF087F70),
    primaryHover: Color(0xFF066A5E),
    primaryText: Color(0xFF05665A),
    onPrimary: Color(0xFFFFFFFF),
    primarySoft: Color(0xFFD9EEE8),
    navy: Color(0xFF173B4D),
    onNavy: Color(0xFFFFFFFF),
    gold: Color(0xFFE6A65D),
    goldText: Color(0xFF8A5A14),
    goldSoft: Color(0xFFFBEEDB),
    success: Color(0xFF1C7A43),
    successSoft: Color(0xFFDFF3E6),
    warning: Color(0xFF975A00),
    warningSoft: Color(0xFFFDF0D5),
    critical: Color(0xFFB42318),
    criticalSoft: Color(0xFFFDE7E4),
    info: Color(0xFF1F5F99),
    infoSoft: Color(0xFFE2EEF9),
    focus: Color(0xFF087F70),
  );
  static const dark = _Palette(
    bg: Color(0xFF0B1A20),
    bg2: Color(0xFF10232B),
    surface: Color(0xFF132A33),
    sunk: Color(0xFF0E2129),
    raise: Color(0xFF17313B),
    line: Color(0xFF244451),
    line2: Color(0xFF335A68),
    fg: Color(0xFFE8F3F0),
    muted: Color(0xFFA7BEC6),
    faint: Color(0xFF7E97A0),
    primary: Color(0xFF3CC4AE),
    primaryHover: Color(0xFF5ED3C0),
    primaryText: Color(0xFF5ED3C0),
    onPrimary: Color(0xFF04231F),
    primarySoft: Color(0xFF123F3B),
    navy: Color(0xFF0E2530),
    onNavy: Color(0xFFE8F3F0),
    gold: Color(0xFFF0BC7E),
    goldText: Color(0xFFF0BC7E),
    goldSoft: Color(0xFF3A2C17),
    success: Color(0xFF5FD08E),
    successSoft: Color(0xFF143A27),
    warning: Color(0xFFF2B544),
    warningSoft: Color(0xFF3A2D10),
    critical: Color(0xFFFF8A80),
    criticalSoft: Color(0xFF43201E),
    info: Color(0xFF7FB6EE),
    infoSoft: Color(0xFF162E47),
    focus: Color(0xFF5ED3C0),
  );
  static const double radiusSm = 10;
  static const double radiusMd = 14;
  static const double radiusLg = 22;
  static const double radiusXl = 28;
  static const double radiusPill = 999;
  static const double touchMin = 44;
  static const Duration durInstant = Duration(milliseconds: 120);
  static const Duration durFast = Duration(milliseconds: 160);
  static const Duration durBase = Duration(milliseconds: 220);
  static const Duration durSlow = Duration(milliseconds: 300);
  static const Duration durEmphasis = Duration(milliseconds: 420);
  static const Curve easeStandard = Cubic(0.2, 0, 0, 1);
  static const Curve easeDecelerate = Cubic(0, 0, 0, 1);
  static const Curve easeAccelerate = Cubic(0.3, 0, 1, 1);
  static const Curve easeEmphasized = Cubic(0.2, 0.9, 0.3, 1);
  static const Duration stagger = Duration(milliseconds: 40);
  static const String fontDisplay = 'Alexandria';
  static const String fontBody = 'Noto Sans Arabic';
}
