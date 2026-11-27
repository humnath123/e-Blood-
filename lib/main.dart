import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ebloods/app.dart';
import 'package:ebloods/core/network/api_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Wake up the server to avoid cold start errors
  ApiClient.wakeServer();
  runApp(
    const ProviderScope(
      child: EBloodsApp(),
    ),
  );
}
