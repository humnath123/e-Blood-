class DonorModel {
  final String id;
  final String userId;
  final String fullName;
  final String email;
  final String phone;
  final String bloodGroup;
  final String lastDonationDate;
  final String? lastDonationLocation;
  final int totalDonations;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? updatedAt;

  DonorModel({
    required this.id,
    required this.userId,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.bloodGroup,
    required this.lastDonationDate,
    this.lastDonationLocation,
    required this.totalDonations,
    required this.isActive,
    required this.createdAt,
    this.updatedAt,
  });

  factory DonorModel.fromJson(Map<String, dynamic> json) => DonorModel(
        id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
        userId: json['userId']?.toString() ?? json['user_id']?.toString() ?? '',
        fullName: json['fullName']?.toString() ?? json['full_name']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        phone: json['phone']?.toString() ?? '',
        bloodGroup: json['bloodGroup']?.toString() ?? json['blood_group']?.toString() ?? 'A+',
        lastDonationDate: json['lastDonationDate']?.toString() ?? json['last_donation_date']?.toString() ?? '',
        lastDonationLocation: json['lastDonationLocation']?.toString() ?? json['last_donation_location']?.toString(),
        totalDonations: (json['totalDonations'] ?? json['total_donations'] ?? 0) as int,
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
        'userId': userId,
        'fullName': fullName,
        'email': email,
        'phone': phone,
        'bloodGroup': bloodGroup,
        'lastDonationDate': lastDonationDate,
        'lastDonationLocation': lastDonationLocation,
        'totalDonations': totalDonations,
        'isActive': isActive,
        'createdAt': createdAt.toIso8601String(),
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };

  DonorModel copyWith({
    String? id,
    String? userId,
    String? fullName,
    String? email,
    String? phone,
    String? bloodGroup,
    String? lastDonationDate,
    String? lastDonationLocation,
    int? totalDonations,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DonorModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      bloodGroup: bloodGroup ?? this.bloodGroup,
      lastDonationDate: lastDonationDate ?? this.lastDonationDate,
      lastDonationLocation: lastDonationLocation ?? this.lastDonationLocation,
      totalDonations: totalDonations ?? this.totalDonations,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
