import 'package:flutter/material.dart';

/// The palette read off the Nexora Figma: indigo actions on an ink-on-paper
/// surface, with one accent per state so a status is never only a word.
abstract final class NexoraColors {
  static const primary = Color(0xFF4F46E5);
  static const primaryPressed = Color(0xFF4338CA);
  static const primarySoft = Color(0xFFEEF0FF);
  static const ink = Color(0xFF111C2E);
  static const inkSoft = Color(0xFF5B6475);
  static const inkFaint = Color(0xFF8A93A5);
  static const background = Color(0xFFF5F5F7);
  static const surface = Colors.white;
  static const border = Color(0xFFE5E7EF);
  static const success = Color(0xFF0F9D6E);
  static const successSoft = Color(0xFFE7F7F0);
  static const warning = Color(0xFFB7791F);
  static const warningSoft = Color(0xFFFDF5E4);
  static const danger = Color(0xFFD64545);
  static const dangerSoft = Color(0xFFFDECEC);
  static const scan = Color(0xFF16A34A);

  static const darkBackground = Color(0xFF0B1220);
  static const darkSurface = Color(0xFF111C2E);
  static const darkSurfaceRaised = Color(0xFF182642);
  static const darkBorder = Color(0xFF26344F);
  static const darkInk = Color(0xFFF4F6FB);
  static const darkInkSoft = Color(0xFFA9B3C6);
  static const darkPrimarySoft = Color(0xFF232A5C);
}

abstract final class NexoraSpace {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}

abstract final class NexoraRadius {
  static const card = 20.0;
  static const field = 14.0;
  static const chip = 999.0;
}

const _latinFont = 'Inter';
const _displayFont = 'SpaceGrotesk';
const _arabicFont = 'IBMPlexSansArabic';

/// Arabic keeps Latin digits: the numerals come from the locale's number
/// symbols configured in `MaterialApp`, never from a translated font.
ThemeData buildNexoraTheme({required bool dark, required String languageCode}) {
  final arabic = languageCode == 'ar';
  final body = arabic ? _arabicFont : _latinFont;
  final display = arabic ? _arabicFont : _displayFont;

  final scheme = ColorScheme(
    brightness: dark ? Brightness.dark : Brightness.light,
    primary: dark ? const Color(0xFF8B8CF8) : NexoraColors.primary,
    onPrimary: Colors.white,
    primaryContainer: dark
        ? NexoraColors.darkPrimarySoft
        : NexoraColors.primarySoft,
    onPrimaryContainer: dark
        ? NexoraColors.darkInk
        : NexoraColors.primaryPressed,
    secondary: dark ? const Color(0xFF9DB7FF) : NexoraColors.ink,
    onSecondary: dark ? NexoraColors.darkBackground : Colors.white,
    secondaryContainer: dark
        ? NexoraColors.darkSurfaceRaised
        : NexoraColors.primarySoft,
    onSecondaryContainer: dark ? NexoraColors.darkInk : NexoraColors.ink,
    tertiary: dark ? const Color(0xFF66D7A6) : NexoraColors.success,
    onTertiary: dark ? NexoraColors.darkBackground : Colors.white,
    error: dark ? const Color(0xFFFF8A8A) : NexoraColors.danger,
    onError: dark ? NexoraColors.darkBackground : Colors.white,
    surface: dark ? NexoraColors.darkSurface : NexoraColors.surface,
    onSurface: dark ? NexoraColors.darkInk : NexoraColors.ink,
    surfaceContainerHighest: dark
        ? NexoraColors.darkSurfaceRaised
        : NexoraColors.background,
    onSurfaceVariant: dark ? NexoraColors.darkInkSoft : NexoraColors.inkSoft,
    outline: dark ? NexoraColors.darkBorder : NexoraColors.border,
    outlineVariant: dark ? NexoraColors.darkBorder : NexoraColors.border,
    shadow: Colors.black26,
    scrim: Colors.black54,
    inverseSurface: dark ? NexoraColors.darkInk : NexoraColors.ink,
    onInverseSurface: dark ? NexoraColors.ink : Colors.white,
    inversePrimary: NexoraColors.primarySoft,
    surfaceTint: Colors.transparent,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: body,
    scaffoldBackgroundColor: dark
        ? NexoraColors.darkBackground
        : NexoraColors.background,
    visualDensity: VisualDensity.standard,
  );

  final text = base.textTheme
      .apply(fontFamily: body)
      .copyWith(
        displayLarge: TextStyle(
          fontFamily: display,
          fontSize: 44,
          height: 1.05,
          fontWeight: FontWeight.w700,
          letterSpacing: -1.2,
          color: scheme.onSurface,
        ),
        displayMedium: TextStyle(
          fontFamily: display,
          fontSize: 34,
          height: 1.1,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.8,
          color: scheme.onSurface,
        ),
        headlineLarge: TextStyle(
          fontFamily: display,
          fontSize: 28,
          height: 1.15,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
          color: scheme.onSurface,
        ),
        headlineMedium: TextStyle(
          fontFamily: display,
          fontSize: 24,
          height: 1.2,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        headlineSmall: TextStyle(
          fontFamily: display,
          fontSize: 20,
          height: 1.25,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        titleLarge: TextStyle(
          fontFamily: display,
          fontSize: 18,
          height: 1.3,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        titleMedium: TextStyle(
          fontFamily: body,
          fontSize: 16,
          height: 1.35,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        titleSmall: TextStyle(
          fontFamily: body,
          fontSize: 14,
          height: 1.35,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        bodyLarge: TextStyle(
          fontFamily: body,
          fontSize: 16,
          height: 1.5,
          fontWeight: FontWeight.w400,
          color: scheme.onSurface,
        ),
        bodyMedium: TextStyle(
          fontFamily: body,
          fontSize: 14,
          height: 1.45,
          fontWeight: FontWeight.w400,
          color: scheme.onSurface,
        ),
        bodySmall: TextStyle(
          fontFamily: body,
          fontSize: 12,
          height: 1.4,
          fontWeight: FontWeight.w400,
          color: scheme.onSurfaceVariant,
        ),
        labelLarge: TextStyle(
          fontFamily: body,
          fontSize: 15,
          height: 1.2,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        labelMedium: TextStyle(
          fontFamily: body,
          fontSize: 12,
          height: 1.2,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
          color: scheme.onSurfaceVariant,
        ),
      );

  OutlineInputBorder border(Color color, {double width = 1}) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(NexoraRadius.field),
        borderSide: BorderSide(color: color, width: width),
      );

  return base.copyWith(
    textTheme: text,
    dividerTheme: DividerThemeData(
      color: scheme.outline,
      thickness: 1,
      space: 1,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: dark
          ? NexoraColors.darkBackground
          : NexoraColors.background,
      surfaceTintColor: Colors.transparent,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: text.titleLarge,
    ),
    cardTheme: CardThemeData(
      color: scheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NexoraRadius.card),
        side: BorderSide(color: scheme.outline),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 54),
        padding: const EdgeInsets.symmetric(horizontal: NexoraSpace.xl),
        textStyle: text.labelLarge,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NexoraRadius.field),
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: NexoraSpace.xl),
        textStyle: text.labelLarge,
        side: BorderSide(color: scheme.outline),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NexoraRadius.field),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(44, 44),
        textStyle: text.labelLarge,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NexoraRadius.field),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? NexoraColors.darkSurfaceRaised : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: border(scheme.outline),
      enabledBorder: border(scheme.outline),
      focusedBorder: border(scheme.primary, width: 1.6),
      errorBorder: border(scheme.error),
      focusedErrorBorder: border(scheme.error, width: 1.6),
      labelStyle: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      hintStyle: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      helperStyle: text.bodySmall,
      errorStyle: text.bodySmall?.copyWith(color: scheme.error),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? NexoraColors.darkSurface : Colors.white,
      surfaceTintColor: Colors.transparent,
      indicatorColor: dark
          ? NexoraColors.darkPrimarySoft
          : NexoraColors.primarySoft,
      elevation: 0,
      height: 72,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => text.labelMedium?.copyWith(
          color: states.contains(WidgetState.selected)
              ? scheme.primary
              : scheme.onSurfaceVariant,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? scheme.primary
              : scheme.onSurfaceVariant,
          size: 24,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: dark ? NexoraColors.darkSurfaceRaised : Colors.white,
      selectedColor: scheme.primaryContainer,
      side: BorderSide(color: scheme.outline),
      labelStyle: text.labelMedium,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NexoraRadius.chip),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NexoraRadius.card),
      ),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      showDragHandle: true,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: dark ? NexoraColors.darkInk : NexoraColors.ink,
      contentTextStyle: text.bodyMedium?.copyWith(
        color: dark ? NexoraColors.ink : Colors.white,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: scheme.onSurfaceVariant,
      textColor: scheme.onSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? Colors.white
            : scheme.onSurfaceVariant,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? scheme.primary
            : scheme.outline,
      ),
    ),
  );
}
