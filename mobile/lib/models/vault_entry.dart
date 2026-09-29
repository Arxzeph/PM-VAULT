import 'dart:convert';

class SecurityQuestion {
  final String question;
  final String answer;

  SecurityQuestion({required this.question, required this.answer});

  Map<String, dynamic> toMap() => {'question': question, 'answer': answer};

  factory SecurityQuestion.fromMap(Map<String, dynamic> map) {
    return SecurityQuestion(
      question: map['question'] as String? ?? '',
      answer: map['answer'] as String? ?? '',
    );
  }
}

class VaultEntry {
  final String id;
  final String title;
  final String? username;
  final String? password;
  final String? url;
  final String? notes;
  final List<SecurityQuestion> securityQuestions;
  final List<String> tags;
  final bool favorite;
  final String ciphertext;
  final String nonce;
  final int version;
  final bool isDeleted;
  final String syncStatus; // 'synced', 'pending_update', 'pending_delete'
  final String clientUpdatedAt;
  final String? serverUpdatedAt;

  VaultEntry({
    required this.id,
    required this.title,
    this.username,
    this.password,
    this.url,
    this.notes,
    this.securityQuestions = const [],
    this.tags = const [],
    this.favorite = false,
    required this.ciphertext,
    required this.nonce,
    this.version = 1,
    this.isDeleted = false,
    this.syncStatus = 'synced',
    required this.clientUpdatedAt,
    this.serverUpdatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'username': username,
      'password': password,
      'url': url,
      'notes': notes,
      'security_questions': jsonEncode(securityQuestions.map((q) => q.toMap()).toList()),
      'tags': jsonEncode(tags),
      'favorite': favorite ? 1 : 0,
      'ciphertext': ciphertext,
      'nonce': nonce,
      'version': version,
      'is_deleted': isDeleted ? 1 : 0,
      'sync_status': syncStatus,
      'client_updated_at': clientUpdatedAt,
      'server_updated_at': serverUpdatedAt,
    };
  }

  factory VaultEntry.fromMap(Map<String, dynamic> map) {
    List<String> parsedTags = [];
    if (map['tags'] != null) {
      try {
        final decoded = jsonDecode(map['tags']);
        if (decoded is List) {
          parsedTags = decoded.map((e) => e.toString()).toList();
        }
      } catch (_) {}
    }

    List<SecurityQuestion> parsedQuestions = [];
    if (map['security_questions'] != null) {
      try {
        final decoded = jsonDecode(map['security_questions']);
        if (decoded is List) {
          parsedQuestions = decoded
              .map((e) => SecurityQuestion.fromMap(Map<String, dynamic>.from(e)))
              .toList();
        }
      } catch (_) {}
    }

    return VaultEntry(
      id: map['id'] as String,
      title: map['title'] as String? ?? 'Untitled',
      username: map['username'] as String?,
      password: map['password'] as String?,
      url: map['url'] as String?,
      notes: map['notes'] as String?,
      securityQuestions: parsedQuestions,
      tags: parsedTags,
      favorite: (map['favorite'] == 1 || map['favorite'] == true),
      ciphertext: map['ciphertext'] as String? ?? '',
      nonce: map['nonce'] as String? ?? '',
      version: map['version'] as int? ?? 1,
      isDeleted: (map['is_deleted'] == 1 || map['is_deleted'] == true),
      syncStatus: map['sync_status'] as String? ?? 'synced',
      clientUpdatedAt: map['client_updated_at'] as String? ?? DateTime.now().toUtc().toIso8601String(),
      serverUpdatedAt: map['server_updated_at'] as String?,
    );
  }

  VaultEntry copyWith({
    String? title,
    String? username,
    String? password,
    String? url,
    String? notes,
    List<SecurityQuestion>? securityQuestions,
    List<String>? tags,
    bool? favorite,
    String? ciphertext,
    String? nonce,
    int? version,
    bool? isDeleted,
    String? syncStatus,
    String? clientUpdatedAt,
    String? serverUpdatedAt,
  }) {
    return VaultEntry(
      id: id,
      title: title ?? this.title,
      username: username ?? this.username,
      password: password ?? this.password,
      url: url ?? this.url,
      notes: notes ?? this.notes,
      securityQuestions: securityQuestions ?? this.securityQuestions,
      tags: tags ?? this.tags,
      favorite: favorite ?? this.favorite,
      ciphertext: ciphertext ?? this.ciphertext,
      nonce: nonce ?? this.nonce,
      version: version ?? this.version,
      isDeleted: isDeleted ?? this.isDeleted,
      syncStatus: syncStatus ?? this.syncStatus,
      clientUpdatedAt: clientUpdatedAt ?? this.clientUpdatedAt,
      serverUpdatedAt: serverUpdatedAt ?? this.serverUpdatedAt,
    );
  }
}
