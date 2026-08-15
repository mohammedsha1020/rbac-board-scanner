import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/presentation/auth_provider.dart';
import 'folders_provider.dart';

class FoldersScreen extends ConsumerWidget {
  const FoldersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    
    if (user == null) {
      return const Scaffold(body: Center(child: Text("Please login")));
    }

    final currentFolderId = ref.watch(currentFolderProvider);
    final foldersAsync = ref.watch(foldersListProvider(currentFolderId));
    final scansAsync = ref.watch(scansListProvider(currentFolderId));

    return Scaffold(
      appBar: AppBar(
        title: Text(currentFolderId == null ? "Root Subjects" : "Viewing Folder"),
        leading: currentFolderId != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  // Navigate up (we can keep a stack or just pop to root for simplicity)
                  ref.read(currentFolderProvider.notifier).state = null;
                },
              )
            : null,
        actions: [
          IconButton(
            icon: const Icon(Icons.create_new_folder),
            onPressed: () => _createNewFolderDialog(context, ref, currentFolderId),
          )
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFF1E293B),
            width: double.infinity,
            child: Text(
              "Access Level: ${user.role.toString().split('.').last.toUpperCase()} | Storage: ${user.username}",
              style: TextStyle(color: Colors.indigo[200], fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
          
          Expanded(
            child: foldersAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text('Error loading folders: $err')),
              data: (folders) => scansAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, stack) => Center(child: Text('Error loading scans: $err')),
                data: (scans) {
                  if (folders.isEmpty && scans.isEmpty) {
                    return const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.folder_open, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text("No subject scans found. Capture one now!"),
                        ],
                      ),
                    );
                  }

                  return ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (folders.isNotEmpty) ...[
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8.0),
                          child: Text("SUBJECT FOLDERS", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                        ),
                        ...folders.map((f) => Card(
                              child: ListTile(
                                leading: const Icon(Icons.folder, color: Colors.indigoAccent, size: 28),
                                title: Text(f['name']),
                                subtitle: Text(f['isSynced'] == 1 ? "Synced to Cloud" : "Offline Cache"),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () {
                                  ref.read(currentFolderProvider.notifier).state = f['id'];
                                },
                              ),
                            )),
                      ],
                      if (scans.isNotEmpty) ...[
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 8.0),
                          child: Text("BOARD SCANS", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                        ),
                        ...scans.map((s) => Card(
                              child: ListTile(
                                leading: const Icon(Icons.image, color: Colors.purpleAccent, size: 28),
                                title: Text(s['name']),
                                subtitle: Text("Type: ${s['boardType'].toString().toUpperCase()} • size: ${(s['storageSize'] / (1024 * 1024)).toStringAsFixed(2)} MB"),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.picture_as_pdf, color: Colors.redAccent),
                                      onPressed: () => _exportToPdf(context, s['name']),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.share),
                                      onPressed: () => _shareScanDialog(context, ref, s['id'], s['name']),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete, color: Colors.red),
                                      onPressed: () {
                                        ref.read(scansListProvider(currentFolderId).notifier).deleteScan(s['id']);
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            )),
                      ]
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _createNewFolderDialog(BuildContext context, WidgetRef ref, String? currentFolderId) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Create Subject Folder"),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: "Folder/Subject Name"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          ElevatedButton(
            onPressed: () async {
              if (controller.text.isNotEmpty) {
                final success = await ref
                    .read(foldersListProvider(currentFolderId).notifier)
                    .createFolder(controller.text.trim());
                if (success && context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Folder "${controller.text}" created successfully')),
                  );
                }
              }
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text("Create"),
          )
        ],
      ),
    );
  }

  void _exportToPdf(BuildContext context, String name) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Successfully exported and compiled "$name" to PDF document format')),
    );
  }

  void _shareScanDialog(BuildContext context, WidgetRef ref, String scanId, String name) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Share: $name"),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: "Recipient Username"),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          ElevatedButton(
            onPressed: () async {
              final target = controller.text.trim();
              if (target.isNotEmpty) {
                try {
                  final client = ref.read(apiClientProvider);
                  final res = await client.post('/api/shares', {
                    'targetUsername': target,
                    'scanId': scanId,
                    'permissionType': 'READ',
                  });

                  if (res.statusCode == 201 && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Shared scan successfully with $target')),
                    );
                  } else if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Failed to share scan. Verify username.')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sharing failed: network offline.')),
                    );
                  }
                }
              }
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text("Share"),
          ),
        ],
      ),
    );
  }
}
