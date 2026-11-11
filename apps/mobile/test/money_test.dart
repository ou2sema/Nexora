import 'package:flutter_test/flutter_test.dart';
import 'package:nexora_mobile/core/money/money.dart';

void main() {
  group('Money.format', () {
    test('always prints three decimals and the TND code', () {
      expect(Money.format(0), '0.000 TND');
      expect(Money.format(5), '0.005 TND');
      expect(Money.format(12000, withCode: false), '12.000');
    });

    test('groups the integer part and keeps the sign', () {
      expect(Money.format(1234567), '1,234.567 TND');
      expect(Money.format(-1234), '-1.234 TND');
    });

    test('input is ungrouped so it can round-trip through a text field', () {
      expect(Money.input(12500), '12.500');
    });
  });

  group('Money.parse', () {
    test('accepts comma, dot, spaces and the three-decimal maximum', () {
      expect(Money.parse('12,5'), 12500);
      expect(Money.parse('12.500'), 12500);
      expect(Money.parse(' 1 234.500 '), 1234500);
      expect(Money.parse('0'), 0);
    });

    test('rejects negatives, finer than one millime and non-numbers', () {
      expect(Money.parse('-5'), isNull);
      expect(Money.parse('12.3456'), isNull);
      expect(Money.parse(''), isNull);
      expect(Money.parse('12.'), isNull);
      expect(Money.parse('abc'), isNull);
    });
  });

  group('Money.parseQuantity', () {
    test('accepts up to four decimals and strictly positive values', () {
      expect(Money.parseQuantity('1,5'), 1.5);
      expect(Money.parseQuantity('0.0001'), 0.0001);
      expect(Money.parseQuantity('0'), isNull);
      expect(Money.parseQuantity('1.23456'), isNull);
    });
  });

  group('Money.parsePercent', () {
    test('stays inside 0..100 with four decimals', () {
      expect(Money.parsePercent('20,5'), 20.5);
      expect(Money.parsePercent('100'), 100);
      expect(Money.parsePercent('100.0001'), isNull);
      expect(Money.parsePercent('101'), isNull);
    });
  });

  group('formatQuantity', () {
    test('drops trailing zeroes and groups thousands', () {
      expect(formatQuantity(1234.5), '1,234.5');
      expect(formatQuantity(1000), '1,000');
      expect(formatQuantity(12.34), '12.34');
      expect(formatQuantity(0), '0');
      expect(formatQuantity(-1234.5), '-1,234.5');
    });

    test('never prints NaN or infinity', () {
      expect(formatQuantity(double.nan), '0');
      expect(formatQuantity(double.infinity), '0');
    });
  });
}
