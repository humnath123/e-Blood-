import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/core/theme/app_colors.dart';
import 'package:ebloods/core/theme/app_text_styles.dart';
import 'package:ebloods/core/utils/responsive_wrapper.dart';
import 'package:ebloods/core/widgets/blood_group_chip.dart';
import 'package:ebloods/core/widgets/empty_state.dart';
import 'package:ebloods/core/widgets/loading_indicator.dart';
import 'package:ebloods/features/donors/presentation/providers/donors_provider.dart';

class DonorsScreen extends ConsumerStatefulWidget {
  const DonorsScreen({super.key});

  @override
  ConsumerState<DonorsScreen> createState() => _DonorsScreenState();
}

class _DonorsScreenState extends ConsumerState<DonorsScreen> {
  String? _selectedBloodGroup;

  @override
  Widget build(BuildContext context) {
    final donorsAsync = ref.watch(donorsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Find Donors'),
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
                          ref.read(donorsProvider.notifier).filterByBloodGroup(
                                _selectedBloodGroup,
                              );
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: donorsAsync.when(
                  loading: () => const LoadingIndicator(message: 'Searching registered donors...'),
                  error: (err, _) => EmptyState(
                    icon: Icons.error_outline,
                    title: 'Unable to load donors',
                    message: err.toString(),
                    buttonText: 'Retry',
                    onRetry: () {
                      ref.read(donorsProvider.notifier).refresh();
                    },
                  ),
                  data: (donors) {
                    if (donors.isEmpty) {
                      return EmptyState(
                        icon: Icons.people_outline,
                        title: 'No Donors Found',
                        message: _selectedBloodGroup != null
                            ? 'No registered donors found for blood group $_selectedBloodGroup.'
                            : 'No donors are currently available in the database.',
                        buttonText: 'Refresh',
                        onRetry: () {
                          ref.read(donorsProvider.notifier).refresh();
                        },
                      );
                    }
                    return RefreshIndicator(
                      color: AppColors.primary,
                      onRefresh: () async {
                        ref.read(donorsProvider.notifier).refresh();
                      },
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: donors.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final donor = donors[index];
                          return Card(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: AppColors.inputBorder),
                            ),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: AppColors.primary,
                                child: Text(
                                  donor.bloodGroup,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              title: Text(
                                donor.fullName,
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(
                                'Total Donations: ${donor.totalDonations} | Last: ${donor.lastDonationDate}',
                                style: AppTextStyles.bodySmall.copyWith(
                                  fontSize: 12,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              trailing: IconButton(
                                icon: const Icon(Icons.phone, color: AppColors.primary),
                                onPressed: () {
                                  // Call donor phone action
                                },
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
