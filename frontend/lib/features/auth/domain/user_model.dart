enum UserRole {
  basic,
  admin,
  god
}

class User {
  final String id;
  final String username;
  final String email;
  final UserRole role;
  final bool isEnabled;
  final bool isLocked;

  User({
    required this.id,
    required this.username,
    required this.email,
    required this.role,
    this.isEnabled = true,
    this.isLocked = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    UserRole parsedRole;
    switch (json['role']?.toString().toUpperCase()) {
      case 'GOD':
        parsedRole = UserRole.god;
        break;
      case 'ADMIN':
        parsedRole = UserRole.admin;
        break;
      case 'BASIC':
      default:
        parsedRole = UserRole.basic;
        break;
    }

    return User(
      id: json['id'] ?? '',
      username: json['username'] ?? '',
      email: json['email'] ?? '',
      role: parsedRole,
      isEnabled: json['isEnabled'] ?? true,
      isLocked: json['isLocked'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'role': role.toString().split('.').last.toUpperCase(),
      'isEnabled': isEnabled,
      'isLocked': isLocked,
    };
  }

  bool get isAtLeastAdmin => role == UserRole.admin || role == UserRole.god;
  bool get isGod => role == UserRole.god;
}
