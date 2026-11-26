import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/utils/responsive_wrapper.dart';
import 'package:ebloods/core/widgets/blood_group_chip.dart';
import 'package:ebloods/core/widgets/empty_state.dart';
import 'package:ebloods/core/widgets/loading_indicator.dart';
import 'package:ebloods/features/blood_requests/presentation/providers/blood_requests_provider.dart';

class BloodRequestsScreen extends ConsumerStatefulWidget {
  const BloodRequestsScreen({super.key});

  @override
  ConsumerState<BloodRequestsScreen> createState() => _BloodRequestsScreenState();
}

class _BloodRequestsScreenState extends ConsumerState<BloodRequestsScreen> {
  String? _selectedBloodGroup;

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(bloodRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Blood Requests'),
        centerTitle: true,
      ),
      body: ResponsiveWrapper(
        child: SafeArea(
          child: Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    'All',
                    'A+',
                    'A-',
                    'B+',
                    'B-',
                    'O+',
                    'O-',
                    'AB+',
                    'AB-',
                  ].map((bg) {
                    final isSelected = (bg == 'All' && _selectedBloodGroup == null) ||
                        _selectedBloodGroup == bg;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: BloodGroupChip(
                        bloodGroup: bg,
                        isSelected: isSelected,
                        onTap: () {
                          setState(() {
                            _selectedBloodGroup = bg == 'All' ? null : bg;
                          });
                          ref.read(bloodRequestsProvider.notifier).filterRequests(
                                bloodGroup: _selectedBloodGroup,
                              );
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: requestsAsync.when(
                  loading: () => const LoadingIndicator(message: 'Loading blood requests...'),
                  error: (err, _) => EmptyState(
                    icon: Icons.error_outline,
                    title: 'Unable to fetch requests',
                    message: err.toString(),
                    buttonText: 'Try Again',
                    onRetry: () {
                      ref.read(bloodRequestsProvider.notifier).refresh();
                    },
                  ),
                  data: (requests) {
                    if (requests.isEmpty) {
                      return EmptyState(
                        icon: Icons.biotech_outlined,
                        title: 'No Blood Requests Found',
                        message: _selectedBloodGroup != null
                            ? 'No active requests matching $_selectedBloodGroup.'
                            : 'No blood requests have been posted yet.',
                        buttonText: 'Refresh',
                        onRetry: () {
                          ref.read(bloodRequestsProvider.notifier).refresh();
                        },
                      );
                    }
                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        ref.read(bloodRequestsProvider.notifier).refresh();
                      },
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: requests.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final req = requests[index];
                          return Card(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: AppColors.inputBorder),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      BloodGroupChip(
                                        bloodGroup: req.bloodGroup,
                                        isSelected: true,
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          color: req.urgency == 'urgent'
                                              ? AppColors.primary
                                              : Colors.orange,
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          req.urgency.toUpperCase(),
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    '${req.unitsRequired} Units required of ${req.requestType}',
                                    style: AppTextStyles.welcomeTitle.copyWith(fontSize: 16),
                                  ),
                                  if (req.notes != null && req.notes!.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      req.notes!,
                                      style: AppTextStyles.bodySmall,
                                    ),
                                  ],
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Status: ${req.status}',
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                      Text(
                                        req.createdAt.toIso8601String().split('T').first,
                                        style: const TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
