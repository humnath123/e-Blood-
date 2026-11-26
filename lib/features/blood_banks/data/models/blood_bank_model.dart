class BloodBankModel {
  final String id;
  final String userId;
  final String name;
  final String organizationCode;
  final String email;
  final String phone;
  final String addressStreet;
  final String addressCity;
  final String addressState;
  final String addressPinCode;
  final String addressCountry;
  final String contactPersonName;
  final String contactPersonDesignation;
  final String contactPersonPhone;
  final String contactPersonEmail;
  final String licenseNumber;
  final String licenseIssuedDate;
  final String licenseExpiryDate;
  final List<String> certifications;
  final Map<String, dynamic> operatingHours;
  final List<String> facilities;
  final int storageCapacity;
  final int currentStock;
  final Map<String, int> bloodGroupStock;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? updatedAt;

  BloodBankModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.organizationCode,
    required this.email,
    required this.phone,
    required this.addressStreet,
    required this.addressCity,
    required this.addressState,
    required this.addressPinCode,
    required this.addressCountry,
    required this.contactPersonName,
    required this.contactPersonDesignation,
    required this.contactPersonPhone,
    required this.contactPersonEmail,
    required this.licenseNumber,
    required this.licenseIssuedDate,
    required this.licenseExpiryDate,
    required this.certifications,
    required this.operatingHours,
    required this.facilities,
    required this.storageCapacity,
    required this.currentStock,
    required this.bloodGroupStock,
    required this.isActive,
    required this.createdAt,
    this.updatedAt,
  });

  factory BloodBankModel.fromJson(Map<String, dynamic> json) {
    final addr = json['address'] is Map ? json['address'] as Map<String, dynamic> : <String, dynamic>{};
    final cp = json['contactPerson'] is Map ? json['contactPerson'] as Map<String, dynamic> : <String, dynamic>{};
    final bgStockRaw = json['bloodGroupStock'] is Map ? json['bloodGroupStock'] as Map<String, dynamic> : <String, dynamic>{};

    return BloodBankModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? json['user_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      organizationCode: json['organizationCode']?.toString() ?? json['organization_code']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      addressStreet: addr['street']?.toString() ?? '',
      addressCity: addr['city']?.toString() ?? '',
      addressState: addr['state']?.toString() ?? '',
      addressPinCode: addr['pinCode']?.toString() ?? addr['pin_code']?.toString() ?? '',
      addressCountry: addr['country']?.toString() ?? 'India',
      contactPersonName: cp['name']?.toString() ?? '',
      contactPersonDesignation: cp['designation']?.toString() ?? '',
      contactPersonPhone: cp['phone']?.toString() ?? '',
      contactPersonEmail: cp['email']?.toString() ?? '',
      licenseNumber: json['licenseNumber']?.toString() ?? json['license_number']?.toString() ?? '',
      licenseIssuedDate: json['licenseIssuedDate']?.toString() ?? json['license_issued_date']?.toString() ?? '',
      licenseExpiryDate: json['licenseExpiryDate']?.toString() ?? json['license_expiry_date']?.toString() ?? '',
      certifications: json['certifications'] is List
          ? (json['certifications'] as List).map((e) => e.toString()).toList()
          : [],
      operatingHours: json['operatingHours'] is Map
          ? Map<String, dynamic>.from(json['operatingHours'] as Map)
          : {},
      facilities: json['facilities'] is List
          ? (json['facilities'] as List).map((e) => e.toString()).toList()
          : [],
      storageCapacity: (json['storageCapacity'] ?? json['storage_capacity'] ?? 0) as int,
      currentStock: (json['currentStock'] ?? json['current_stock'] ?? 0) as int,
      bloodGroupStock: bgStockRaw.map((k, v) => MapEntry(k, (v ?? 0) as int)),
      isActive: json['isActive'] == true || json['is_active'] == true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'name': name,
        'organizationCode': organizationCode,
        'email': email,
        'phone': phone,
        'address': {
          'street': addressStreet,
          'city': addressCity,
          'state': addressState,
          'pinCode': addressPinCode,
          'country': addressCountry,
        },
        'contactPerson': {
          'name': contactPersonName,
          'designation': contactPersonDesignation,
          'phone': contactPersonPhone,
          'email': contactPersonEmail,
        },
        'licenseNumber': licenseNumber,
        'licenseIssuedDate': licenseIssuedDate,
        'licenseExpiryDate': licenseExpiryDate,
        'certifications': certifications,
        'operatingHours': operatingHours,
        'facilities': facilities,
        'storageCapacity': storageCapacity,
        'currentStock': currentStock,
        'bloodGroupStock': bloodGroupStock,
        'isActive': isActive,
        'createdAt': createdAt.toIso8601String(),
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };

  BloodBankModel copyWith({
    String? id,
    String? userId,
    String? name,
    String? organizationCode,
    String? email,
    String? phone,
    String? addressStreet,
    String? addressCity,
    String? addressState,
    String? addressPinCode,
    String? addressCountry,
    String? contactPersonName,
    String? contactPersonDesignation,
    String? contactPersonPhone,
    String? contactPersonEmail,
    String? licenseNumber,
    String? licenseIssuedDate,
    String? licenseExpiryDate,
    List<String>? certifications,
    Map<String, dynamic>? operatingHours,
    List<String>? facilities,
    int? storageCapacity,
    int? currentStock,
    Map<String, int>? bloodGroupStock,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return BloodBankModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      name: name ?? this.name,
      organizationCode: organizationCode ?? this.organizationCode,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      addressStreet: addressStreet ?? this.addressStreet,
      addressCity: addressCity ?? this.addressCity,
      addressState: addressState ?? this.addressState,
      addressPinCode: addressPinCode ?? this.addressPinCode,
      addressCountry: addressCountry ?? this.addressCountry,
      contactPersonName: contactPersonName ?? this.contactPersonName,
      contactPersonDesignation: contactPersonDesignation ?? this.contactPersonDesignation,
      contactPersonPhone: contactPersonPhone ?? this.contactPersonPhone,
      contactPersonEmail: contactPersonEmail ?? this.contactPersonEmail,
      licenseNumber: licenseNumber ?? this.licenseNumber,
      licenseIssuedDate: licenseIssuedDate ?? this.licenseIssuedDate,
      licenseExpiryDate: licenseExpiryDate ?? this.licenseExpiryDate,
      certifications: certifications ?? this.certifications,
      operatingHours: operatingHours ?? this.operatingHours,
      facilities: facilities ?? this.facilities,
      storageCapacity: storageCapacity ?? this.storageCapacity,
      currentStock: currentStock ?? this.currentStock,
      bloodGroupStock: bloodGroupStock ?? this.bloodGroupStock,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
