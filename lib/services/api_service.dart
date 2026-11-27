import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user_model.dart';
import '../models/donor_model.dart';
import '../models/blood_bank_model.dart';
import '../models/inventory_model.dart';
import '../models/event_model.dart';
import '../models/notification_model.dart';
import '../models/request_model.dart';
import '../models/reward_model.dart';
import '../models/campaign_model.dart';

/// Base URL for the production backend
const String baseUrl = 'https://e-blood-magw.onrender.com';
/// Alternative base URL (from Swagger/docs)
/// const String baseUrl = 'https://e-blood-j14l.onrender.com';

/// Auth API endpoints
class AuthApi {
  /// Register a new user
  static Future<Map<String, dynamic>> register({
    required String identifier,
    required String email,
    required String username,
    required String phone,
    required String bloodGroup,
    required String password,
    required String role,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'identifier': identifier,
        'email': email,
        'username': username,
        'phone': phone,
        'bloodGroup': bloodGroup,
        'password': password,
        'role': role,
      }),
    );
    return _handleResponse(response);
  }

  /// Login user
  static Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'identifier': identifier,
        'password': password,
      }),
    );
    return _handleResponse(response);
  }

  /// Refresh access token
  static Future<Map<String, dynamic>> refresh({
    required String refreshToken,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'refreshToken': refreshToken}),
    );
    return _handleResponse(response);
  }

  /// Logout (revoke all refresh tokens)
  static Future<Map<String, dynamic>> logout({
    required String accessToken,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/logout'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }

  /// Forgot password - send reset code
  static Future<Map<String, dynamic>> forgotPassword({
    required String identifier,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'identifier': identifier}),
    );
    return _handleResponse(response);
  }

  /// Reset password with reset code
  static Future<Map<String, dynamic>> resetPassword({
    required String identifier,
    required String resetCode,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/reset-password'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'identifier': identifier,
        'resetCode': resetCode,
        'newPassword': newPassword,
        'confirmPassword': confirmPassword,
      }),
    );
    return _handleResponse(response);
  }

  /// Get current user profile
  static Future<Map<String, dynamic>> getMe({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Change password
  static Future<Map<String, dynamic>> changePassword({
    required String accessToken,
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/password'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      }),
    );
    return _handleResponse(response);
  }

  /// Google sign-in (development stub)
  static Future<Map<String, dynamic>> googleSignIn() async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/google'),
      headers: {'Content-Type': 'application/json'},
    );
    return _handleResponse(response);
  }
}

/// Profile API endpoints
class ProfileApi {
  /// Get current profile
  static Future<Map<String, dynamic>> getProfile({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/me'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Update profile (username, email, phone, bloodGroup)
  static Future<Map<String, dynamic>> updateProfile({
    required String accessToken,
    String? username,
    String? email,
    String? phone,
    String? bloodGroup,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/me'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'username': username,
        'email': email,
        'phone': phone,
        'blood_group': bloodGroup,
      }),
    );
    return _handleResponse(response);
  }

  /// Update user location
  static Future<Map<String, dynamic>> updateLocation({
    required String accessToken,
    required double latitude,
    required double longitude,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/me/location'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'latitude': latitude,
        'longitude': longitude,
      }),
    );
    return _handleResponse(response);
  }

  /// Update donor availability
  static Future<Map<String, dynamic>> updateDonorAvailability({
    required String accessToken,
    required bool isAvailable,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/me/donor-availability'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'is_available': isAvailable}),
    );
    return _handleResponse(response);
  }
}

/// Donors API endpoints
class DonorsApi {
  /// List donors (public)
  static Future<Map<String, dynamic>> listDonors({
    String? bloodGroup,
    String? search,
    String? city,
  }) async {
    final Uri uri = Uri.parse('$baseUrl/donors')
        .replace(queryParameters: {
      if (bloodGroup != null) 'bloodGroup': bloodGroup,
      if (search != null) 'search': search,
      if (city != null) 'city': city,
    });
    final response = await http.get(
      uri,
      headers: {'Content-Type': 'application/json'},
    );
    return _handleResponse(response);
  }

  /// Get donor by ID (public)
  static Future<Map<String, dynamic>> getDonor({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/donors/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Create a new donor account (public)
  static Future<Map<String, dynamic>> createDonor({
    required String email,
    required String username,
    required String password,
    required String phone,
    String? bloodGroup,
    required String accessToken,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/donors'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'email': email,
        'username': username,
        'password': password,
        'phone': phone,
        if (bloodGroup != null) 'bloodGroup': bloodGroup,
      }),
    );
    return _handleResponse(response);
  }

  /// Update donor fields
  static Future<Map<String, dynamic>> updateDonor({
    required int id,
    required String accessToken,
    String? username,
    String? email,
    String? phone,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/donors/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'username': username,
        'email': email,
        'phone': phone,
      }),
    );
    return _handleResponse(response);
  }

  /// Soft-delete donor
  static Future<Map<String, dynamic>> deleteDonor({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/donors/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }
}

/// Blood Banks API endpoints
class BloodBanksApi {
  /// List blood banks (public)
  static Future<Map<String, dynamic>> listBloodBanks({
    String? search,
    String? city,
  }) async {
    final Uri uri = Uri.parse('$baseUrl/blood-banks')
        .replace(queryParameters: {
      if (search != null) 'search': search,
      if (city != null) 'city': city,
    });
    final response = await http.get(
      uri,
      headers: {'Content-Type': 'application/json'},
    );
    return _handleResponse(response);
  }

  /// Get blood bank with inventory
  static Future<Map<String, dynamic>> getBloodBank({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/blood-banks/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Create a blood bank
  static Future<Map<String, dynamic>> createBloodBank({
    required String name,
    required double latitude,
    required double longitude,
    String? address,
    String? phone,
    String? email,
    required String accessToken,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/blood-banks'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'name': name,
        'latitude': latitude,
        'longitude': longitude,
        if (address != null) 'address': address,
        if (phone != null) 'phone': phone,
        if (email != null) 'email': email,
      }),
    );
    return _handleResponse(response);
  }

  /// Update blood bank fields
  static Future<Map<String, dynamic>> updateBloodBank({
    required int id,
    required String accessToken,
    String? name,
    String? address,
    String? phone,
    String? email,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/blood-banks/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'name': name,
        'address': address,
        'phone': phone,
        'email': email,
      }),
    );
    return _handleResponse(response);
  }

  /// Delete blood bank
  static Future<Map<String, dynamic>> deleteBloodBank({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/blood-banks/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }
}

/// Inventory API endpoints (blood bank staff)
class InventoryApi {
  /// Get own facility's inventory
  static Future<Map<String, dynamic>> getInventory({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/inventory'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }

  /// Add new inventory item
  static Future<Map<String, dynamic>> addInventory({
    required String accessToken,
    required String bloodGroup,
    required String component,
    required int units,
    String? expiryDate,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/inventory'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'blood_group': bloodGroup,
        'component': component,
        'units': units,
        if (expiryDate != null) 'expiry_date': expiryDate,
      }),
    );
    return _handleResponse(response);
  }

  /// Update inventory item units
  static Future<Map<String, dynamic>> updateInventory({
    required int id,
    required String accessToken,
    required int units,
    bool? isVerified,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/inventory/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'units': units,
        if (isVerified != null) 'is_verified': isVerified,
      }),
    );
    return _handleResponse(response);
  }

  /// Get expiring inventory
  static Future<Map<String, dynamic>> getExpiringInventory({
    required String accessToken,
    int days = 7,
  }) async {
    final Uri uri = Uri.parse('$baseUrl/inventory/expiring')
        .replace(queryParameters: {'days': days.toString()});
    final response = await http.get(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }
}

/// Events API endpoints (Donation Events)
class EventsApi {
  /// List donation events (public, role-based filtering)
  static Future<Map<String, dynamic>> listEvents({
    String? status,
  }) async {
    final Uri uri = Uri.parse('$baseUrl/events')
        .replace(queryParameters: status != null ? {'status': status} : {});
    final response = await http.get(
      uri,
      headers: {'Content-Type': 'application/json'},
    );
    return _handleResponse(response);
  }

  /// Create a new donation event
  static Future<Map<String, dynamic>> createEvent({
    required String accessToken,
    required String title,
    required String organizerName,
    required String organizerContact,
    required String location,
    required DateTime startsAt,
    required DateTime endsAt,
    required DateTime registrationDeadline,
    String? description,
    String? bannerUrl,
    int? maxParticipants,
    double? latitude,
    double? longitude,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/events'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'title': title,
        'description': description,
        'banner_url': bannerUrl,
        'organizer_name': organizerName,
        'organizer_contact': organizerContact,
        'location': location,
        'latitude': latitude,
        'longitude': longitude,
        'starts_at': startsAt.toIso8601String(),
        'ends_at': endsAt.toIso8601String(),
        'registration_deadline': registrationDeadline.toIso8601String(),
        if (maxParticipants != null) 'max_participants': maxParticipants,
      }),
    );
    return _handleResponse(response);
  }

  /// Get a single event
  static Future<Map<String, dynamic>> getEvent({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/events/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Edit event details
  static Future<Map<String, dynamic>> editEvent({
    required String accessToken,
    required int id,
    String? title,
    String? description,
    String? bannerUrl,
    String? location,
    DateTime? startsAt,
    DateTime? endsAt,
    DateTime? registrationDeadline,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/events/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'title': title,
        'description': description,
        'banner_url': bannerUrl,
        'location': location,
        'starts_at': startsAt?.toIso8601String(),
        'ends_at': endsAt?.toIso8601String(),
        'registration_deadline': registrationDeadline?.toIso8601String(),
      }),
    );
    return _handleResponse(response);
  }

  /// Delete event (DRAFT only)
  static Future<Map<String, dynamic>> deleteEvent({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/events/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Advance event lifecycle status
  static Future<Map<String, dynamic>> advanceEventStatus({
    required String accessToken,
    required int id,
    required String status,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/events/$id/status'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'status': status}),
    );
    return _handleResponse(response);
  }

  /// Register for an event
  static Future<Map<String, dynamic>> registerForEvent({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/events/$id/register'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Cancel event registration
  static Future<Map<String, dynamic>> cancelEventRegistration({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/events/$id/register'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// List event registrations
  static Future<Map<String, dynamic>> listEventRegistrations({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/events/$id/registrations'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Record attendance status
  static Future<Map<String, dynamic>> recordAttendance({
    required String accessToken,
    required int id,
    required int registrationId,
    required String attendanceStatus,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/events/$id/registrations/$registrationId/attendance'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'attendance_status': attendanceStatus}),
    );
    return _handleResponse(response);
  }

  /// Link a completed donation to a registration
  static Future<Map<String, dynamic>> linkDonationToRegistration({
    required String accessToken,
    required int id,
    required int registrationId,
    required int donationId,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/events/$id/registrations/$registrationId/donation'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'donation_id': donationId}),
    );
    return _handleResponse(response);
  }

  /// Get event statistics
  static Future<Map<String, dynamic>> getEventStatistics({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/events/$id/statistics'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }
}

/// Search API endpoints
class SearchApi {
  /// Search blood banks, hospitals, and donors near coordinates
  static Future<Map<String, dynamic>> search({
    required String bloodGroup,
    String? component,
    int? units,
    required double latitude,
    required double longitude,
    double? radiusKm,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/search'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'bloodGroup': bloodGroup,
        if (component != null) 'component': component,
        if (units != null) 'units': units,
        'latitude': latitude,
        'longitude': longitude,
        if (radiusKm != null) 'radiusKm': radiusKm,
      }),
    );
    return _handleResponse(response);
  }
}

/// Requests API endpoints (Blood Requests)
class RequestsApi {
  /// Create a new blood request
  static Future<Map<String, dynamic>> createRequest({
    required String accessToken,
    required String bloodGroup,
    required String component,
    required int unitsNeeded,
    String? urgency,
    int? hospitalId,
    required double latitude,
    required double longitude,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/requests'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'blood_group': bloodGroup,
        'component': component,
        'units_needed': unitsNeeded,
        if (urgency != null) 'urgency': urgency,
        if (hospitalId != null) 'hospital_id': hospitalId,
        'latitude': latitude,
        'longitude': longitude,
      }),
    );
    return _handleResponse(response);
  }

  /// List blood requests
  static Future<Map<String, dynamic>> listRequests({
    required String accessToken,
    String? status,
    String? bloodGroup,
  }) async {
    final Uri uri = Uri.parse('$baseUrl/requests')
        .replace(queryParameters: {
      if (status != null) 'status': status,
      if (bloodGroup != null) 'blood_group': bloodGroup,
    });
    final response = await http.get(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }

  /// Get a single request
  static Future<Map<String, dynamic>> getRequest({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/requests/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Cancel a blood request
  static Future<Map<String, dynamic>> cancelRequest({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/requests/$id/cancel'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }

  /// Update a blood request
  static Future<Map<String, dynamic>> updateRequest({
    required String accessToken,
    required int id,
    String? bloodGroup,
    int? unitsRequired,
    String? urgency,
    String? status,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/requests/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'bloodGroup': bloodGroup,
        'unitsRequired': unitsRequired,
        'urgency': urgency,
        'status': status,
      }),
    );
    return _handleResponse(response);
  }

  /// Respond to a match (donor accepts/declines)
  static Future<Map<String, dynamic>> respondToMatch({
    required String accessToken,
    required int id,
    required int matchId,
    required String response,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/requests/$id/matches/$matchId/respond'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'response': response}),
    );
    return _handleResponse(response);
  }
}

/// Notifications API endpoints
class NotificationsApi {
  /// List notifications for a user
  static Future<Map<String, dynamic>> listNotifications({
    required String accessToken,
    int? userId,
  }) async {
    final Uri uri = userId != null
        ? Uri.parse('$baseUrl/notifications').replace(queryParameters: {'userId': userId.toString()})
        : Uri.parse('$baseUrl/notifications');
    final response = await http.get(
      uri,
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Mark a single notification as read
  static Future<Map<String, dynamic>> markAsRead({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/notifications/$id/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Mark all unread notifications as read
  static Future<Map<String, dynamic>> markAllAsRead({
    required String accessToken,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/notifications/read-all'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Delete a notification
  static Future<Map<String, dynamic>> deleteNotification({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/notifications/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }
}

/// Rewards API endpoints
class RewardsApi {
  /// Get user's rewards points balance
  static Future<Map<String, dynamic>> getRewards({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/rewards'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Redeem points
  static Future<Map<String, dynamic>> redeemPoints({
    required String accessToken,
    required int id,
    int? pointsToRedeem,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/rewards/$id/redeem'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        if (pointsToRedeem != null) 'points_to_redeem': pointsToRedeem,
      }),
    );
    return _handleResponse(response);
  }

  /// Get redemption history
  static Future<Map<String, dynamic>> getRedemptions({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/rewards/redemptions'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }
}

/// Campaigns API endpoints
class CampaignsApi {
  /// List all campaigns (public)
  static Future<Map<String, dynamic>> listCampaigns() async {
    final response = await http.get(
      Uri.parse('$baseUrl/campaigns'),
      headers: {'Content-Type': 'application/json'},
    );
    return _handleResponse(response);
  }

  /// Create a new campaign
  static Future<Map<String, dynamic>> createCampaign({
    required String accessToken,
    required String title,
    required String targetBloodGroup,
    required int targetUnits,
    required String targetDate,
    String? description,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/campaigns'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'title': title,
        'description': description,
        'target_blood_group': targetBloodGroup,
        'target_units': targetUnits,
        'target_date': targetDate,
      }),
    );
    return _handleResponse(response);
  }

  /// Join a campaign as a participant
  static Future<Map<String, dynamic>> joinCampaign({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/campaigns/$id/join'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Get campaign statistics
  static Future<Map<String, dynamic>> getCampaignStats() async {
    final response = await http.get(
      Uri.parse('$baseUrl/campaigns/stats'),
      headers: {'Content-Type': 'application/json'},
    );
    return _handleResponse(response);
  }

  /// Get a single campaign
  static Future<Map<String, dynamic>> getCampaign({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/campaigns/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Edit campaign details
  static Future<Map<String, dynamic>> editCampaign({
    required String accessToken,
    required int id,
    String? title,
    String? description,
    String? targetBloodGroup,
    int? targetUnits,
    String? targetDate,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/campaigns/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'title': title,
        'description': description,
        'target_blood_group': targetBloodGroup,
        'target_units': targetUnits,
        'target_date': targetDate,
      }),
    );
    return _handleResponse(response);
  }

  /// Delete campaign (DRAFT only)
  static Future<Map<String, dynamic>> deleteCampaign({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/campaigns/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }
}

/// Transports API endpoints (Blood Transport)
class TransportsApi {
  /// List transport requests
  static Future<Map<String, dynamic>> listTransports({
    String? status,
  }) async {
    final Uri uri = status != null
        ? Uri.parse('$baseUrl/transports').replace(queryParameters: {'status': status})
        : Uri.parse('$baseUrl/transports');
    final response = await http.get(
      uri,
      headers: {'Content-Type': 'application/json'},
    );
    return _handleResponse(response);
  }

  /// Create a blood transport request
  static Future<Map<String, dynamic>> createTransport({
    required String accessToken,
    required int sourceBankId,
    required int destinationHospitalId,
    required String bloodGroup,
    required int units,
    required String pickupAddress,
    required String destinationAddress,
    String? component,
    String? pickupLatitude,
    String? pickupLongitude,
    String? destinationLatitude,
    String? destinationLongitude,
    String? estimatedArrival,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/transports'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'source_bank_id': sourceBankId,
        'destination_hospital_id': destinationHospitalId,
        'blood_group': bloodGroup,
        'units': units,
        'pickup_address': pickupAddress,
        'destination_address': destinationAddress,
        if (component != null) 'component': component,
        if (pickupLatitude != null) 'pickup_latitude': double.tryParse(pickupLatitude),
        if (pickupLongitude != null) 'pickup_longitude': double.tryParse(pickupLongitude),
        if (destinationLatitude != null) 'destination_latitude': double.tryParse(destinationLatitude),
        if (destinationLongitude != null) 'destination_longitude': double.tryParse(destinationLongitude),
        if (estimatedArrival != null) 'estimated_arrival': estimatedArrival,
      }),
    );
    return _handleResponse(response);
  }

  /// Get a transport request
  static Future<Map<String, dynamic>> getTransport({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/transports/$id'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Get transport audit history
  static Future<Map<String, dynamic>> getTransportHistory({
    required int id,
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/transports/$id/history'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Assign active blood bank staff driver and vehicle
  static Future<Map<String, dynamic>> assignTransport({
    required String accessToken,
    required int id,
    required int driverUserId,
    required String vehicleIdentifier,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/transports/$id/assign'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'driver_user_id': driverUserId,
        'vehicle_identifier': vehicleIdentifier,
      }),
    );
    return _handleResponse(response);
  }

  /// Advance a transport workflow status
  static Future<Map<String, dynamic>> advanceTransportStatus({
    required String accessToken,
    required int id,
    required String status,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/transports/$id/status'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'status': status}),
    );
    return _handleResponse(response);
  }

  /// Record the latest GPS coordinates and optional ETA
  static Future<Map<String, dynamic>> updateTransportLocation({
    required String accessToken,
    required int id,
    required double latitude,
    required double longitude,
    String? estimatedArrival,
    String? notes,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/transports/$id/location'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'latitude': latitude,
        'longitude': longitude,
        if (estimatedArrival != null) 'estimated_arrival': estimatedArrival,
        if (notes != null) 'notes': notes,
      }),
    );
    return _handleResponse(response);
  }

  /// Confirm delivery after arrival
  static Future<Map<String, dynamic>> confirmDelivery({
    required String accessToken,
    required int id,
    required String confirmation,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/transports/$id/confirm-delivery'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'confirmation': confirmation}),
    );
    return _handleResponse(response);
  }
}

/// Donations API endpoints
class DonationsApi {
  /// Get current user's donations
  static Future<Map<String, dynamic>> getMyDonations({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/donations/me'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// List facility donations (blood bank staff)
  static Future<Map<String, dynamic>> listDonations({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/donations'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }

  /// Record a donation
  static Future<Map<String, dynamic>> recordDonation({
    required String accessToken,
    required int bankId,
    required String components,
    required int units,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/donations'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        'bank_id': bankId,
        'components': components,
        'units': units,
      }),
    );
    return _handleResponse(response);
  }

  /// Update donation status
  static Future<Map<String, dynamic>> updateDonationStatus({
    required String accessToken,
    required int id,
    required String status,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/donations/$id'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'status': status}),
    );
    return _handleResponse(response);
  }

  /// Email a completed donation certificate to the donor
  static Future<Map<String, dynamic>> emailCertificate({
    required String accessToken,
    required int id,
    bool? retry,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/donations/$id/certificate'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({
        if (retry != null) 'retry': retry,
      }),
    );
    return _handleResponse(response);
  }
}

/// Admin API endpoints
class AdminApi {
  /// Verify a blood bank (admin only)
  static Future<Map<String, dynamic>> verifyBloodBank({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/admin/blood-banks/$id/verify'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }

  /// Verify a hospital (admin only)
  static Future<Map<String, dynamic>> verifyHospital({
    required String accessToken,
    required int id,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/admin/hospitals/$id/verify'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _handleResponse(response);
  }

  /// Get system-wide stats (admin only)
  static Future<Map<String, dynamic>> getAdminStats({
    required String accessToken,
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/admin/stats'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    return _handleResponse(response);
  }

  /// Update a user's role (admin only)
  static Future<Map<String, dynamic>> updateUserRole({
    required String accessToken,
    required int id,
    required String role,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/admin/users/$id/role'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: json.encode({'role': role}),
    );
    return _handleResponse(response);
  }
}

/// Helper method to handle HTTP responses
Map<String, dynamic> _handleResponse(http.Response response) {
  final body = json.decode(response.body);
  
  if (response.statusCode >= 200 && response.statusCode < 300) {
    return {
      'success': body['success'] ?? true,
      'data': body['data'],
      'message': body['message'],
      'error': body['error'],
    };
  } else {
    return {
      'success': false,
      'data': null,
      'message': body['message'] ?? 'Request failed',
      'error': body['error'] ?? 'Unknown error',
    };
  }
}