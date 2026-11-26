class DonationHistoryModel {
  final String id;
  final String donorId;
  final String donationCampId;
  final String bloodGroup;
  final int unitsDonated;
  final String donationDate;
  final String donationLocation;
  final String? collectedBy;
  final String? status; // 'completed', 'pending', 'cancelled'
  final bool isActive;
  final DateTime createdAt;
  final DateTime? updatedAt;

  DonationHistoryModel({
    required this.id,
    required this.donorId,
    required this.donationCampId,
    required this.bloodGroup,
    required this.unitsDonated,
    required this.donationDate,
    required this.donationLocation,
    this.collectedBy,
    this.status,
    required this.isActive,
    required this.createdAt,
    this.updatedAt,
  });

  factory DonationHistoryModel.fromJson(Map<String, dynamic> json) => DonationHistoryModel(
        id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
        donorId: json['donorId']?.toString() ?? json['donor_id']?.toString() ?? '',
        donationCampId: json['donationCampId']?.toString() ?? json['donation_camp_id']?.toString() ?? '',
        bloodGroup: json['bloodGroup']?.toString() ?? json['blood_group']?.toString() ?? 'A+',
        unitsDonated: (json['unitsDonated'] ?? json['units_donated'] ?? 1) as int,
        donationDate: json['donationDate']?.toString() ?? json['donation_date']?.toString() ?? '',
        donationLocation: json['donationLocation']?.toString() ?? json['donation_location']?.toString() ?? '',
        collectedBy: json['collectedBy']?.toString() ?? json['collected_by']?.toString(),
        status: json['status']?.toString() ?? 'completed',
        isActive: json['isActive'] == true || json['is_active'] == true,
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
            : DateTime.now(),
        updatedAt: json['updatedAt'] != null
            ? DateTime.tryParse(json['updatedAt'].toString())
            : null,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'donorId': donorId,
        'donationCampId': donationCampId,
        'bloodGroup': bloodGroup,
        'unitsDonated': unitsDonated,
        'donationDate': donationDate,
        'donationLocation': donationLocation,
        'collectedBy': collectedBy,
        'status': status,
        'isActive': isActive,
        'createdAt': createdAt.toIso8601String(),
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };

  DonationHistoryModel copyWith({
    String? id,
    String? donorId,
    String? donationCampId,
    String? bloodGroup,
    int? unitsDonated,
    String? donationDate,
    String? donationLocation,
    String? collectedBy,
    String? status,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DonationHistoryModel(
      id: id ?? this.id,
      donorId: donorId ?? this.donorId,
      donationCampId: donationCampId ?? this.donationCampId,
      bloodGroup: bloodGroup ?? this.bloodGroup,
      unitsDonated: unitsDonated ?? this.unitsDonated,
      donationDate: donationDate ?? this.donationDate,
      donationLocation: donationLocation ?? this.donationLocation,
      collectedBy: collectedBy ?? this.collectedBy,
      status: status ?? this.status,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
