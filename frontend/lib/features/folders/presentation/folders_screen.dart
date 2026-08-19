import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:rbac_board_scanner/features/auth/presentation/auth_provider.dart';
import 'package:rbac_board_scanner/features/folders/presentation/folders_provider.dart';

import 'package:permission_handler/permission_handler.dart';

final fileSystemTabProvider = StateProvider<int>((ref) => 0); // 0: App Sandbox, 1: Device Storage (A-Z)
final deviceCurrentPathProvider = StateProvider<String>((ref) => "/storage/emulated/0");
final deviceSearchQueryProvider = StateProvider<String>((ref) => "");
final searchQueryProvider = StateProvider<String>((ref) => "");

class FoldersScreen extends ConsumerStatefulWidget {
  final String? targetUserId;
  final String? targetUsername;
  const FoldersScreen({super.key, this.targetUserId, this.targetUsername});

  @override
  ConsumerState<FoldersScreen> createState() => _FoldersScreenState();
}

class _FoldersScreenState extends ConsumerState<FoldersScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _requestStoragePermission();
  }

  Future<void> _requestStoragePermission() async {
    await [
      Permission.storage,
      Permission.manageExternalStorage,
    ].request();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user;
    if (user == null) return const Scaffold(body: Center(child: Text("Please login")));

    final isInspecting = widget.targetUserId != null;
    final activeTab = isInspecting ? 0 : ref.watch(fileSystemTabProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(isInspecting ? "${widget.targetUsername}'s Files" : (activeTab == 0 ? "App File Manager" : "Android Device Storage")),
        bottom: isInspecting ? null : PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            color: const Color(0xFF1E293B),
            child: Row(
              children: [
                _buildTabButton(ref, 0, "App Sandbox", Icons.folder_shared),
                _buildTabButton(ref, 1, "Device Storage (A-Z)", Icons.phone_android),
              ],
            ),
          ),
        ),
      ),
      body: activeTab == 0 
          ? _buildAppSandboxView(user) 
          : _buildDeviceStorageView(),
    );
  }

  Widget _buildTabButton(WidgetRef ref, int index, String label, IconData icon) {
    final activeTab = ref.watch(fileSystemTabProvider);
    final isSelected = activeTab == index;
    return Expanded(
      child: InkWell(
        onTap: () => ref.read(fileSystemTabProvider.notifier).state = index,
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? const Color(0xFF6366F1) : Colors.transparent,
                width: 3,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: isSelected ? const Color(0xFF6366F1) : Colors.grey),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- TAB 1: APP SANDBOX VIEW ---
  Widget _buildAppSandboxView(dynamic user) {
    final currentFolderId = ref.watch(currentFolderProvider);
    final searchQuery = ref.watch(searchQueryProvider);
    final foldersAsync = ref.watch(foldersListProvider(currentFolderId));
    final scansAsync = ref.watch(scansListProvider(currentFolderId));

    return Column(
      children: [
        if (user.isAtLeastAdmin) _buildSandboxSelector(ref, user),
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: "Search folders & board files...",
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
            ),
            onChanged: (val) => ref.read(searchQueryProvider.notifier).state = val.trim(),
          ),
        ),
        _buildBreadcrumbs(ref, currentFolderId),
        Expanded(
          child: foldersAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, stack) => Center(child: Text('Error: $err')),
            data: (folders) => scansAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text('Error: $err')),
              data: (scans) {
                var filteredFolders = folders;
                var filteredScans = scans;

                if (searchQuery.isNotEmpty) {
                  filteredFolders = folders.where((f) => f['name'].toString().toLowerCase().contains(searchQuery.toLowerCase())).toList();
                  filteredScans = scans.where((s) => s['name'].toString().toLowerCase().contains(searchQuery.toLowerCase())).toList();
                }

                if (filteredFolders.isEmpty && filteredScans.isEmpty) {
                  return const Center(child: Text("Empty directory. Capture blackboard scans!"));
                }

                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (filteredFolders.isNotEmpty) ...[
                      const Text("FOLDERS", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey)),
                      ...filteredFolders.map((f) => ListTile(
                            leading: const Icon(Icons.folder, color: Colors.indigoAccent),
                            title: Text(f['name']),
                            onTap: () => ref.read(currentFolderProvider.notifier).state = f['id'],
                          )),
                    ],
                    if (filteredScans.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      const Text("BOARD SCANS", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.grey)),
                      ...filteredScans.map((s) => ListTile(
                            leading: const Icon(Icons.insert_drive_file, color: Colors.purpleAccent),
                            title: Text(s['name']),
                            subtitle: Text("Size: ${(s['storageSize'] / (1024 * 1024)).toStringAsFixed(2)} MB"),
                            onTap: () => _viewFileMetadata(s),
                          )),
                    ]
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  // --- TAB 2: ANDROID SYSTEM EX-STORAGE EXPLORER (A to Z) ---
  Widget _buildDeviceStorageView() {
    final currentPath = ref.watch(deviceCurrentPathProvider);
    final search = ref.watch(deviceSearchQueryProvider);

    List<FileSystemEntity> entities = [];
    String errorMsg = "";

    try {
      final dir = Directory(currentPath);
      if (dir.existsSync()) {
        entities = dir.listSync();
        
        // Sort Alphabetically from A to Z (Folders first, then Files)
        entities.sort((a, b) {
          final aIsDir = a is Directory;
          final bIsDir = b is Directory;
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.path.toLowerCase().compareTo(b.path.toLowerCase());
        });

        // Apply search query filter
        if (search.isNotEmpty) {
          entities = entities.where((e) {
            final name = e.path.split('/').last;
            return name.toLowerCase().contains(search.toLowerCase());
          }).toList();
        }
      } else {
        errorMsg = "Directory does not exist. (Simulating root path)";
        entities = _generateMockAndroidFileSystem(currentPath);
      }
    } catch (e) {
      errorMsg = "Permission Denied. Set MANAGE_EXTERNAL_STORAGE permission.\nFalling back to simulated storage.";
      entities = _generateMockAndroidFileSystem(currentPath);
    }

    return Column(
      children: [
        // Path input / breadcrumb lister
        Container(
          padding: const EdgeInsets.all(12),
          color: const Color(0xFF1E293B),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_upward, size: 20),
                onPressed: currentPath == "/" ? null : () {
                  final parts = currentPath.split('/');
                  if (parts.length > 1) {
                    parts.removeLast();
                    final parent = parts.join('/');
                    ref.read(deviceCurrentPathProvider.notifier).state = parent.isEmpty ? "/" : parent;
                  }
                },
              ),
              Expanded(
                child: Text(
                  currentPath,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 13, color: Colors.indigoAccent),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),

        // Search Input
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: TextField(
            decoration: InputDecoration(
              hintText: "Search Android files (A to Z)...",
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(vertical: 6),
            ),
            onChanged: (val) => ref.read(deviceSearchQueryProvider.notifier).state = val.trim(),
          ),
        ),

        if (errorMsg.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(8),
            color: Colors.amber.withOpacity(0.15),
            width: double.infinity,
            child: Text(errorMsg, style: const TextStyle(color: Colors.amber, fontSize: 11), textAlign: TextAlign.center),
          ),

        // Alphabetic scroll list
        Expanded(
          child: entities.isEmpty
              ? const Center(child: Text("Directory is empty"))
              : ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: entities.length,
                  itemBuilder: (context, index) {
                    final item = entities[index];
                    final isDir = item is Directory;
                    final name = item.path.split('/').last;

                    return Card(
                      child: ListTile(
                        leading: Icon(
                          isDir ? Icons.folder : Icons.insert_drive_file,
                          color: isDir ? Colors.amber[700] : Colors.blueGrey,
                        ),
                        title: Text(name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                        subtitle: Text(
                          isDir ? "Folder" : "File • ${_formatFileSize(item)}",
                          style: const TextStyle(fontSize: 11),
                        ),
                        trailing: isDir 
                            ? const Icon(Icons.arrow_forward_ios, size: 12)
                            : IconButton(
                                icon: const Icon(Icons.download, size: 18),
                                onPressed: () => _importFileToApp(name),
                              ),
                        onTap: () {
                          if (isDir) {
                            ref.read(deviceCurrentPathProvider.notifier).state = item.path;
                            ref.read(deviceSearchQueryProvider.notifier).state = "";
                          }
                        },
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // Generate simulated file folders for emulator/desktop environments
  List<FileSystemEntity> _generateMockAndroidFileSystem(String path) {
    if (path == "/storage/emulated/0" || path == "/") {
      return [
        Directory("$path/Alarms"),
        Directory("$path/Android"),
        Directory("$path/DCIM"),
        Directory("$path/Documents"),
        Directory("$path/Downloads"),
        Directory("$path/Movies"),
        Directory("$path/Music"),
        Directory("$path/Pictures"),
        Directory("$path/Podcasts"),
        Directory("$path/Ringtones"),
      ];
    } else if (path.endsWith("DCIM")) {
      return [
        Directory("$path/Camera"),
        Directory("$path/Screenshots"),
      ];
    } else if (path.endsWith("Camera")) {
      return [
        File("$path/IMG_20260728_101230.jpg"),
        File("$path/IMG_20260728_154522.jpg"),
      ];
    } else if (path.endsWith("Downloads")) {
      return [
        File("$path/Classroom_Notes_Math.pdf"),
        File("$path/Physics_Lab_Syllabus.docx"),
        File("$path/BoardCapture_Setup.apk"),
      ];
    }
    return [];
  }

  String _formatFileSize(FileSystemEntity entity) {
    if (entity is File) {
      try {
        final len = entity.lengthSync();
        return "${(len / 1024).toStringAsFixed(1)} KB";
      } catch (e) {
        return "1.2 MB"; // default mock size
      }
    }
    return "";
  }

  void _importFileToApp(String filename) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Importing "$filename" into Classroom Board Scanner Sandbox...')),
    );
  }

  // --- APP SANDBOX UI HELPERS ---
  Widget _buildSandboxSelector(WidgetRef ref, dynamic user) {
    final List<Map<String, String>> usersList = [
      {'id': 'u1', 'name': 'basic_john (Student)'},
      {'id': 'u2', 'name': 'basic_emma (Student)'},
      if (user.isGod) {'id': 'u3', 'name': 'admin_clark (Admin)'},
    ];
    final currentSandbox = ref.watch(selectedSandboxUserProvider) ?? user.id;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.deepPurple.withOpacity(0.15),
      child: Row(
        children: [
          const Icon(Icons.admin_panel_settings, color: Colors.indigoAccent),
          const SizedBox(width: 8),
          const Text("User Sandbox:", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          const SizedBox(width: 16),
          Expanded(
            child: DropdownButton<String>(
              value: currentSandbox,
              isDense: true,
              onChanged: (val) {
                ref.read(selectedSandboxUserProvider.notifier).state = val;
                ref.read(currentFolderProvider.notifier).state = null;
              },
              items: usersList.map((usr) {
                return DropdownMenuItem<String>(
                  value: usr['id'],
                  child: Text(usr['name']!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBreadcrumbs(WidgetRef ref, String? currentFolderId) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      alignment: Alignment.centerLeft,
      color: const Color(0xFF1E293B),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => ref.read(currentFolderProvider.notifier).state = null,
            child: const Text("Root Subjects", style: TextStyle(color: Colors.indigoAccent, fontWeight: FontWeight.bold, fontSize: 13)),
          ),
          if (currentFolderId != null) ...[
            const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
            const Text("Viewing Subject", style: TextStyle(color: Colors.white, fontSize: 13)),
          ]
        ],
      ),
    );
  }

  void _viewFileMetadata(Map<String, dynamic> scan) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(scan['name']),
        content: Text("Path: ${scan['filePath']}\nSize: ${(scan['storageSize'] / (1024*1024)).toStringAsFixed(2)} MB"),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text("Close"))],
      ),
    );
  }
}
