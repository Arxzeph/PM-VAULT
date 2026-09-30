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

/// In-memory UI/domain DTO for a decrypted vault entry.
/// This model is NEVER directly serialized into database columns or network payloads.
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
  final int revision;
  final bool isDeleted;
  final String
      syncStatus; // 'synced', 'pending_insert', 'pending_update', 'pending_delete'
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
    this.revision = 1,
    this.isDeleted = false,
    this.syncStatus = 'synced',
    required this.clientUpdatedAt,
    this.serverUpdatedAt,
  });

  /// Deprecated backwards-compatibility alias for UI code expecting `version`.
  @Deprecated('Use revision instead per V2.2 canonical contract')
  int get version => revision;

  /// Serializes payload for RFC 8785 Canonical JSON encryption.
  Map<String, dynamic> toCanonicalPayload() {
    return {
      'favorite': favorite,
      'notes': notes,
      'password': password,
      'schema_version': 2,
      'security_questions': securityQuestions
          .map((q) => {
                'answer': q.answer,
                'question': q.question,
              })
          .toList(),
      'tags': tags,
      'title': title,
      'url': url,
      'username': username,
    };
  }

  factory VaultEntry.fromDecryptedPayload({
    required String id,
    required Map<String, dynamic> payload,
    required String ciphertext,
    required String nonce,
    required int revision,
    required bool isDeleted,
    required String syncStatus,
    required String clientUpdatedAt,
    String? serverUpdatedAt,
  }) {
    List<SecurityQuestion> parsedQuestions = [];
    if (payload['security_questions'] is List) {
      for (final item in payload['security_questions'] as List) {
        if (item is Map) {
          parsedQuestions.add(
            SecurityQuestion.fromMap(Map<String, dynamic>.from(item)),
          );
        }
      }
    }

    List<String> parsedTags = [];
    if (payload['tags'] is List) {
      parsedTags = (payload['tags'] as List).map((e) => e.toString()).toList();
    }

    return VaultEntry(
      id: id,
      title: payload['title'] as String? ?? 'Untitled',
      username: payload['username'] as String?,
      password: payload['password'] as String?,
      url: payload['url'] as String?,
      notes: payload['notes'] as String?,
      securityQuestions: parsedQuestions,
      tags: parsedTags,
      favorite: (payload['favorite'] == true || payload['favorite'] == 1),
      ciphertext: ciphertext,
      nonce: nonce,
      revision: revision,
      isDeleted: isDeleted,
      syncStatus: syncStatus,
      clientUpdatedAt: clientUpdatedAt,
      serverUpdatedAt: serverUpdatedAt,
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
    int? revision,
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
      revision: revision ?? version ?? this.revision,
      isDeleted: isDeleted ?? this.isDeleted,
      syncStatus: syncStatus ?? this.syncStatus,
      clientUpdatedAt: clientUpdatedAt ?? this.clientUpdatedAt,
      serverUpdatedAt: serverUpdatedAt ?? this.serverUpdatedAt,
    );
  }
}
