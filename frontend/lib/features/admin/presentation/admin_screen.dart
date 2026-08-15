import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import 'admin_provider.dart';

class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    
    // Initial fetch of data
    Future.microtask(() {
      ref.read(adminProvider.notifier).fetchUsers();
      ref.read(adminProvider.notifier).fetchDevices();
      ref.read(adminProvider.notifier).fetchAuditLogs();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    
    final adminState = ref.watch(adminProvider);

    // Security check
    if (user == null || !user.isAtLeastAdmin) {
      return const Scaffold(
        body: Center(
          child: Text(
            "Access Denied: Insufficient authorization level.",
            style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(user.isGod ? "God Admin Workspace (L3)" : "Administrator Panel (L2)"),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF6366F1),
          tabs: [
            const Tab(icon: Icon(Icons.people), text: "Users"),
            const Tab(icon: Icon(Icons.phone_android), text: "Devices"),
            Tab(
              icon: Icon(user.isGod ? Icons.security : Icons.history),
              text: user.isGod ? "Audits" : "Logs",
            ),
          ],
        ),
      ),
      body: adminState.isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildUsersTab(adminState.users, user.isGod),
                _buildDevicesTab(adminState.devices),
                _buildAuditsTab(adminState.auditLogs, user.isGod),
              ],
            ),
    );
  }

  Widget _buildUsersTab(List<dynamic> users, bool isGod) {
    if (users.isEmpty) {
      return const Center(child: Text("No monitored users found"));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: users.length,
      itemBuilder: (context, index) {
        final u = users[index];
        final roleStr = u['role']?.toString() ?? 'BASIC';
        final isLocked = u['isLocked'] == true;

        return Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: roleStr == 'GOD'
                  ? Colors.redAccent[100]
                  : (roleStr == 'ADMIN' ? Colors.purpleAccent[100] : Colors.blueAccent[100]),
              child: Text(
                u['username']?[0]?.toString().toUpperCase() ?? 'U',
                style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
              ),
            ),
            title: Text(u['username'] ?? ''),
            subtitle: Text("${u['email'] ?? ''} • Level: $roleStr"),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: Icon(
                    isLocked ? Icons.lock : Icons.lock_open,
                    color: isLocked ? Colors.red : Colors.grey,
                  ),
                  onPressed: () => _toggleLock(u['id'], isLocked, u['username']),
                ),
                IconButton(
                  icon: const Icon(Icons.vpn_key),
                  onPressed: () => _resetPasswordDialog(u['id'], u['username']),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDevicesTab(List<dynamic> devices) {
    if (devices.isEmpty) {
      return const Center(child: Text("No active device telemetry reports found"));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: devices.length,
      itemBuilder: (context, index) {
        final d = devices[index];
        final ownerStr = d['user']?['username']?.toString() ?? 'unknown';
        final sizeBytes = int.tryParse(d['storageUsage']?.toString() ?? '0') ?? 0;
        final sizeMb = sizeBytes / (1024 * 1024);

        return Card(
          child: ListTile(
            leading: const Icon(Icons.smartphone, color: Colors.indigoAccent),
            title: Text(d['deviceName'] ?? 'Generic Device'),
            subtitle: Text("User: $ownerStr • OS: ${d['androidVersion'] ?? 'Android'}"),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text("${sizeMb.toStringAsFixed(1)} MB", style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(
                  d['syncStatus'] ?? 'Offline',
                  style: TextStyle(
                    color: d['syncStatus'] == 'Synced' ? Colors.greenAccent : Colors.orangeAccent,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAuditsTab(List<dynamic> logs, bool isGod) {
    if (!isGod) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24.0),
          child: Text(
            "Access Restricted: Only L3 God clearance can inspect central database audit logs.",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey),
          ),
        ),
      );
    }

    if (logs.isEmpty) {
      return const Center(child: Text("Audit trail is empty"));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: logs.length,
      itemBuilder: (context, index) {
        final log = logs[index];
        final userStr = log['user']?['username']?.toString() ?? 'SYSTEM';
        final timeStr = log['createdAt']?.toString().substring(11, 19) ?? '';

        return Card(
          color: const Color(0xFF1E293B),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "[$timeStr] $userStr",
                      style: TextStyle(color: Colors.indigo[200], fontWeight: FontWeight.bold),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.purple.withOpacity(0.3),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        log['action'] ?? 'LOG',
                        style: const TextStyle(fontSize: 10, color: Colors.purpleAccent),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(log['details'] ?? '', style: const TextStyle(color: Colors.white70)),
              ],
            ),
          ),
        );
      },
    );
  }

  void _toggleLock(String userId, bool isLocked, String username) async {
    final success = await ref.read(adminProvider.notifier).toggleUserLock(userId, isLocked);
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Account for "$username" updated: Locked = ${!isLocked}')),
      );
    }
  }

  void _resetPasswordDialog(String userId, String username) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Reset Password for $username"),
        content: TextField(
          controller: controller,
          obscureText: true,
          decoration: const InputDecoration(labelText: "New Password"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          ElevatedButton(
            onPressed: () async {
              if (controller.text.isNotEmpty) {
                final success = await ref
                    .read(adminProvider.notifier)
                    .resetPassword(userId, controller.text);
                if (success && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Password for $username has been reset successfully')),
                  );
                }
              }
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text("Reset"),
          ),
        ],
      ),
    );
  }
}
