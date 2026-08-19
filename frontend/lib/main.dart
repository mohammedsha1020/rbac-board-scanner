import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/auth_provider.dart';
import 'features/scanner/presentation/camera_screen.dart';
import 'features/folders/presentation/folders_screen.dart';
import 'features/admin/presentation/admin_screen.dart';

void main() {
  runApp(
    const ProviderScope(
      child: BoardScannerApp(),
    ),
  );
}

class BoardScannerApp extends StatelessWidget {
  const BoardScannerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Classroom Board Scanner',
      theme: AppTheme.darkTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      debugShowCheckedModeBanner: false,
      home: const AuthGate(),
    );
  }
}

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);

    if (authState.isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (authState.user != null) {
      return const MainContainer();
    }

    return const LoginScreen();
  }
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscureText = true;
  bool _isSignUpMode = false;
  bool _keepMeSignedIn = true;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: SingleChildScrollView(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.blur_linear_rounded, size: 80, color: Color(0xFF6366F1)),
                  const SizedBox(height: 16),
                  const Text(
                    "BoardScanner.app",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _isSignUpMode ? "Create a new scanner account" : "Capture, Warp and Enhance classroom whiteboards.",
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 24),

                  // Segmented Switch: Sign In vs Create Account
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ChoiceChip(
                        label: const Text("Sign In"),
                        selected: !_isSignUpMode,
                        selectedColor: const Color(0xFF6366F1),
                        labelStyle: TextStyle(
                          color: !_isSignUpMode ? Colors.white : Colors.white60,
                          fontWeight: FontWeight.bold,
                        ),
                        onSelected: (_) => setState(() => _isSignUpMode = false),
                      ),
                      const SizedBox(width: 12),
                      ChoiceChip(
                        label: const Text("Create Account"),
                        selected: _isSignUpMode,
                        selectedColor: const Color(0xFF6366F1),
                        labelStyle: TextStyle(
                          color: _isSignUpMode ? Colors.white : Colors.white60,
                          fontWeight: FontWeight.bold,
                        ),
                        onSelected: (_) => setState(() => _isSignUpMode = true),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  if (_isSignUpMode) ...[
                    TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: "Email Address",
                        prefixIcon: const Icon(Icons.email),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  TextField(
                    controller: _usernameController,
                    decoration: InputDecoration(
                      labelText: "Username",
                      prefixIcon: const Icon(Icons.person),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  TextField(
                    controller: _passwordController,
                    obscureText: _obscureText,
                    decoration: InputDecoration(
                      labelText: "Password",
                      prefixIcon: const Icon(Icons.lock),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureText ? Icons.visibility : Icons.visibility_off),
                        onPressed: () => setState(() => _obscureText = !_obscureText),
                      ),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Checkbox(
                        value: _keepMeSignedIn,
                        activeColor: const Color(0xFF6366F1),
                        onChanged: (val) => setState(() => _keepMeSignedIn = val ?? true),
                      ),
                      const Text("Keep me signed in", style: TextStyle(color: Colors.white70)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  if (authState.errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Container(
                        constraints: const BoxConstraints(maxHeight: 120),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
                        ),
                        child: SingleChildScrollView(
                          child: SelectableText(
                            authState.errorMessage!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    ),

                  ElevatedButton(
                    onPressed: authState.isLoading ? null : _onSubmitPressed,
                    child: authState.isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : Text(_isSignUpMode ? "Create Account & Sign In" : "Access Scanner"),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _onSubmitPressed() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final email = _emailController.text.trim();

    if (_isSignUpMode) {
      if (username.isEmpty || email.isEmpty || password.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill out username, email, and password')),
        );
        return;
      }
      await ref.read(authProvider.notifier).register(username, email, password);
    } else {
      if (username.isEmpty || password.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please fill out all fields')),
        );
        return;
      }
      await ref.read(authProvider.notifier).login(username, password);
    }
  }
}

class MainContainer extends ConsumerStatefulWidget {
  const MainContainer({super.key});

  @override
  ConsumerState<MainContainer> createState() => _MainContainerState();
}

class _MainContainerState extends ConsumerState<MainContainer> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final user = auth.user!;

    // Compile tabs dynamically based on user role.
    // L1 basic user does not see or get access to Admin Hub
    final List<Widget> screens = [
      const CameraScreen(),
      const FoldersScreen(),
      if (user.isAtLeastAdmin) const AdminScreen(),
    ];

    final List<BottomNavigationBarItem> navItems = [
      const BottomNavigationBarItem(icon: Icon(Icons.camera), label: "Scanner"),
      const BottomNavigationBarItem(icon: Icon(Icons.folder_shared), label: "Folders"),
      if (user.isAtLeastAdmin)
        BottomNavigationBarItem(
          icon: Icon(user.isGod ? Icons.security : Icons.admin_panel_settings),
          label: user.isGod ? "God Panel" : "Admin Panel",
        ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: navItems,
      ),
    );
  }
}
