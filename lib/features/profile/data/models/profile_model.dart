class ProfileModel {
  final String id;
  final String userId;
  final String firstName;
  final String lastName;
  final String email;
  final String? phone;
  final String? bloodGroup;
  final String? lastDonationDate;
  final String? lastDonationLocation;
  final int totalDonations;
  final DateTime createdAt;
  final DateTime? updatedAt;

  ProfileModel({
    required this.id,
    required this.userId,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.phone,
    this.bloodGroup,
    this.lastDonationDate,
    this.lastDonationLocation,
    required this.totalDonations,
    required this.createdAt,
    this.updatedAt,
  });

  factory ProfileModel.fromJson(Map<String, dynamic> json) => ProfileModel(
        id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
        userId: json['userId']?.toString() ?? json['user_id']?.toString() ?? '',
        firstName: json['firstName']?.toString() ?? json['first_name']?.toString() ?? '',
        lastName: json['lastName']?.toString() ?? json['last_name']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        phone: json['phone']?.toString(),
        bloodGroup: json['bloodGroup']?.toString() ?? json['blood_group']?.toString(),
        lastDonationDate: json['lastDonationDate']?.toString() ?? json['last_donation_date']?.toString(),
        lastDonationLocation: json['lastDonationLocation']?.toString() ?? json['last_donation_location']?.toString(),
        totalDonations: (json['totalDonations'] ?? json['total_donations'] ?? 0) as int,
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
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'phone': phone,
        'bloodGroup': bloodGroup,
        'lastDonationDate': lastDonationDate,
        'lastDonationLocation': lastDonationLocation,
        'totalDonations': totalDonations,
        'createdAt': createdAt.toIso8601String(),
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };

  ProfileModel copyWith({
    String? id,
    String? userId,
    String? firstName,
    String? lastName,
    String? email,
    String? phone,
    String? bloodGroup,
    String? lastDonationDate,
    String? lastDonationLocation,
    int? totalDonations,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return ProfileModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      bloodGroup: bloodGroup ?? this.bloodGroup,
      lastDonationDate: lastDonationDate ?? this.lastDonationDate,
      lastDonationLocation: lastDonationLocation ?? this.lastDonationLocation,
      totalDonations: totalDonations ?? this.totalDonations,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
