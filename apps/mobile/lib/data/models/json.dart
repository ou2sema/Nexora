typedef Json = Map<String, dynamic>;

Json asJson(Object? value) =>
    value is Map<String, dynamic> ? value : const <String, dynamic>{};

Json? asJsonOrNull(Object? value) =>
    value is Map<String, dynamic> ? value : null;

List<Json> asJsonList(Object? value) => value is List
    ? value.whereType<Map<String, dynamic>>().toList(growable: false)
    : const [];

String asString(Json json, String key, [String fallback = '']) {
  final value = json[key];
  return value is String ? value : fallback;
}

String? asStringOrNull(Json json, String key) {
  final value = json[key];
  return value is String && value.isNotEmpty ? value : null;
}

int asInt(Json json, String key, [int fallback = 0]) {
  final value = json[key];
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

int? asIntOrNull(Json json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

double asDouble(Json json, String key, [double fallback = 0]) {
  final value = json[key];
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

double? asDoubleOrNull(Json json, String key) {
  final value = json[key];
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

bool asBool(Json json, String key, [bool fallback = false]) {
  final value = json[key];
  return value is bool ? value : fallback;
}

DateTime? asDate(Json json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

List<String> asStringList(Object? value) => value is List
    ? value.whereType<String>().toList(growable: false)
    : const [];

T enumFromWire<T extends Enum>(List<T> values, String? wire, T fallback) {
  for (final value in values) {
    if (value.name == wire) return value;
  }
  return fallback;
}

class Paged<T> {
  const Paged({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  final List<T> items;
  final int page;
  final int pageSize;
  final int total;

  bool get hasMore => page * pageSize < total;
  int get pageCount => total == 0 ? 1 : ((total + pageSize - 1) ~/ pageSize);

  static Paged<T> fromJson<T>(Object? value, T Function(Json json) item) {
    final json = asJson(value);
    return Paged<T>(
      items: asJsonList(json['items']).map(item).toList(growable: false),
      page: asInt(json, 'page', 1),
      pageSize: asInt(json, 'pageSize', 25),
      total: asInt(json, 'total'),
    );
  }

  static Paged<T> empty<T>() =>
      Paged<T>(items: const [], page: 1, pageSize: 25, total: 0);
}

Map<String, dynamic> withoutNulls(Map<String, dynamic> source) {
  final result = <String, dynamic>{};
  for (final entry in source.entries) {
    if (entry.value != null) result[entry.key] = entry.value;
  }
  return result;
}
