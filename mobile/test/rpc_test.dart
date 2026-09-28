import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  test('Test Supabase RPC get_vault_salt', () async {
    final client = SupabaseClient(
      'https://fdavvijioofchmkgmihg.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYXZ2aWppb29mY2hta2dtaWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODQzMDIsImV4cCI6MjEwNjE2MDMwMn0.8c3urWFa1v1_JZkl-xElT4Pq77qvKGp-hAw6oROrNiQ',
    );

    try {
      final res = await client.rpc(
        'get_vault_salt',
        params: {'user_email': 'onlyvalorant3092@gmail.com'},
      );
      print('RPC SUCCESS: $res');
      expect(res, '4JGJAhdgr6sz6FGqwG6vdg==');
    } catch (e) {
      print('RPC FAILED: $e');
      rethrow;
    }
  });
}
