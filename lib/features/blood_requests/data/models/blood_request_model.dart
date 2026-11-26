class BloodRequestModel {
  final String id;
  final String userId;
  final String requestType; // 'blood', 'components', 'platelets'
  final String bloodGroup;
  final int unitsRequired;
  final String urgency; // 'urgent', 'high', 'routine'
  final String status; // 'pending', 'in_progress', 'completed', 'cancelled'
  final String? requestedBy;
  final String? requestedAt;
  final String? fulfilledBy;
  final String? fulfilledAt;
  final String? notes;
  final bool isActive;
  final DateTime createdAt;
  final DateTime? updatedAt;

  BloodRequestModel({
    required this.id,
    required this.userId,
    required this.requestType,
    required this.bloodGroup,
    required this.unitsRequired,
    required this.urgency,
    required this.status,
    this.requestedBy,
    this.requestedAt,
    this.fulfilledBy,
    this.fulfilledAt,
    this.notes,
    required this.isActive,
    required this.createdAt,
    this.updatedAt,
  });

  factory BloodRequestModel.fromJson(Map<String, dynamic> json) => BloodRequestModel(
        id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
        userId: json['userId']?.toString() ?? json['user_id']?.toString() ?? '',
        requestType: json['requestType']?.toString() ?? json['request_type']?.toString() ?? 'blood',
        bloodGroup: json['bloodGroup']?.toString() ?? json['blood_group']?.toString() ?? 'A+',
        unitsRequired: (json['unitsRequired'] ?? json['units_required'] ?? 1) as int,
        urgency: json['urgency']?.toString() ?? 'routine',
        status: json['status']?.toString() ?? 'pending',
        requestedBy: json['requestedBy']?.toString() ?? json['requested_by']?.toString(),
        requestedAt: json['requestedAt']?.toString() ?? json['requested_at']?.toString(),
        fulfilledBy: json['fulfilledBy']?.toString() ?? json['fulfilled_by']?.toString(),
        fulfilledAt: json['fulfilledAt']?.toString() ?? json['fulfilled_at']?.toString(),
        notes: json['notes']?.toString(),
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
        'requestType': requestType,
        'bloodGroup': bloodGroup,
        'unitsRequired': unitsRequired,
        'urgency': urgency,
        'status': status,
        'requestedBy': requestedBy,
        'requestedAt': requestedAt,
        'fulfilledBy': fulfilledBy,
        'fulfilledAt': fulfilledAt,
        'notes': notes,
        'isActive': isActive,
        'createdAt': createdAt.toIso8601String(),
        if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
      };

  BloodRequestModel copyWith({
    String? id,
    String? userId,
    String? requestType,
    String? bloodGroup,
    int? unitsRequired,
    String? urgency,
    String? status,
    String? requestedBy,
    String? requestedAt,
    String? fulfilledBy,
    String? fulfilledAt,
    String? notes,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return BloodRequestModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      requestType: requestType ?? this.requestType,
      bloodGroup: bloodGroup ?? this.bloodGroup,
      unitsRequired: unitsRequired ?? this.unitsRequired,
      urgency: urgency ?? this.urgency,
      status: status ?? this.status,
      requestedBy: requestedBy ?? this.requestedBy,
      requestedAt: requestedAt ?? this.requestedAt,
      fulfilledBy: fulfilledBy ?? this.fulfilledBy,
      fulfilledAt: fulfilledAt ?? this.fulfilledAt,
      notes: notes ?? this.notes,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
