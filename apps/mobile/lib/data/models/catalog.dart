import 'json.dart';

enum ProductStatus {
  active,
  inactive,
  discontinued,
  archived;

  static ProductStatus parse(String? wire) =>
      enumFromWire(ProductStatus.values, wire, ProductStatus.active);
}

class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.name,
    this.description,
    this.categoryId,
    this.categoryName,
    this.brandId,
    this.brandName,
    this.manufacturerModel,
    this.barcode,
    this.internalCode,
    required this.unitOfMeasure,
    this.purchasePriceMinor,
    this.salePriceMinor,
    required this.reorderThreshold,
    required this.isSerialized,
    this.isIndividuallyTracked = false,
    required this.status,
    this.imagePath,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String sku;
  final String name;
  final String? description;
  final String? categoryId;
  final String? categoryName;
  final String? brandId;
  final String? brandName;
  final String? manufacturerModel;
  final String? barcode;
  final String? internalCode;
  final String unitOfMeasure;
  final int? purchasePriceMinor;
  final int? salePriceMinor;
  final double reorderThreshold;
  final bool isSerialized;
  final bool isIndividuallyTracked;
  final ProductStatus status;
  final String? imagePath;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory Product.fromJson(Json json) => Product(
    id: asString(json, 'id'),
    sku: asString(json, 'sku'),
    name: asString(json, 'name'),
    description: asStringOrNull(json, 'description'),
    categoryId: asStringOrNull(json, 'categoryId'),
    categoryName: asStringOrNull(json, 'categoryName'),
    brandId: asStringOrNull(json, 'brandId'),
    brandName: asStringOrNull(json, 'brandName'),
    manufacturerModel: asStringOrNull(json, 'manufacturerModel'),
    barcode: asStringOrNull(json, 'barcode'),
    internalCode: asStringOrNull(json, 'internalCode'),
    unitOfMeasure: asString(json, 'unitOfMeasure', 'unit'),
    purchasePriceMinor: asIntOrNull(json, 'purchasePriceMinor'),
    salePriceMinor: asIntOrNull(json, 'salePriceMinor'),
    reorderThreshold: asDouble(json, 'reorderThreshold'),
    isSerialized: asBool(json, 'isSerialized'),
    isIndividuallyTracked: asBool(json, 'isIndividuallyTracked'),
    status: ProductStatus.parse(asStringOrNull(json, 'status')),
    imagePath: asStringOrNull(json, 'imagePath'),
    createdAt: asDate(json, 'createdAt'),
    updatedAt: asDate(json, 'updatedAt'),
  );

  Map<String, dynamic> toCreateJson() => withoutNulls({
    'sku': sku,
    'name': name,
    'description': description,
    'categoryId': categoryId,
    'brandId': brandId,
    'manufacturerModel': manufacturerModel,
    'barcode': barcode,
    'internalCode': internalCode,
    'unitOfMeasure': unitOfMeasure,
    'purchasePriceMinor': purchasePriceMinor,
    'salePriceMinor': salePriceMinor,
    'reorderThreshold': reorderThreshold,
    'isSerialized': isSerialized,
    'isIndividuallyTracked': isIndividuallyTracked,
    'status': status.name,
  });
}

class Category {
  const Category({required this.id, required this.name, this.parentId});

  final String id;
  final String name;
  final String? parentId;

  factory Category.fromJson(Json json) => Category(
    id: asString(json, 'id'),
    name: asString(json, 'name'),
    parentId: asStringOrNull(json, 'parentId'),
  );
}

class Brand {
  const Brand({required this.id, required this.name});

  final String id;
  final String name;

  factory Brand.fromJson(Json json) =>
      Brand(id: asString(json, 'id'), name: asString(json, 'name'));
}

class StorageLocation {
  const StorageLocation({
    required this.id,
    required this.warehouseId,
    required this.code,
    required this.name,
    required this.isActive,
  });

  final String id;
  final String warehouseId;
  final String code;
  final String name;
  final bool isActive;

  String get display => '$code · $name';

  factory StorageLocation.fromJson(Json json) => StorageLocation(
    id: asString(json, 'id'),
    warehouseId: asString(json, 'warehouseId'),
    code: asString(json, 'code'),
    name: asString(json, 'name'),
    isActive: asBool(json, 'isActive', true),
  );
}

class Warehouse {
  const Warehouse({
    required this.id,
    required this.code,
    required this.name,
    this.city,
    required this.isActive,
    required this.locations,
  });

  final String id;
  final String code;
  final String name;
  final String? city;
  final bool isActive;
  final List<StorageLocation> locations;

  factory Warehouse.fromJson(Json json) => Warehouse(
    id: asString(json, 'id'),
    code: asString(json, 'code'),
    name: asString(json, 'name'),
    city: asStringOrNull(json, 'city'),
    isActive: asBool(json, 'isActive', true),
    locations: asJsonList(json['locations'])
        .map(StorageLocation.fromJson)
        .toList(growable: false),
  );

  Iterable<StorageLocation> get activeLocations =>
      locations.where((location) => location.isActive);
}
