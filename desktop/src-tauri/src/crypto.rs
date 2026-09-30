use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    XChaCha20Poly1305, XNonce,
};
use hkdf::Hkdf;
use rand::{rngs::OsRng, RngCore};
use sha2::{Digest, Sha256};
use zeroize::{Zeroize, Zeroizing};

// Cryptographic constants locked per BUILD_PLAN.md & Phase 6 specs
pub const ARGON2_M_COST: u32 = 65536; // 64 MiB
pub const ARGON2_T_COST: u32 = 3; // 3 iterations
pub const ARGON2_P_COST: u32 = 4; // 4 parallelism
pub const SALT_LEN: usize = 16;
pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 24;

pub const DEK_AAD_LEGACY_V1: &[u8] = b"pm:dek:v1";
#[allow(dead_code)]
pub const DEK_AAD: &[u8] = DEK_AAD_LEGACY_V1;
pub const AUTH_VERIFIER_INFO: &[u8] = b"pm:auth:supabase_password";

pub const RECOVERY_WRAP_INFO: &[u8] = b"pm-vault-recovery-wrap-v2";
pub const RECOVERY_AUTH_INFO: &[u8] = b"pm-vault-recovery-auth-v2";

/// Derives the 32-byte Master Key (MK) using Argon2id.
pub fn derive_master_key(
    master_password: &str,
    salt: &[u8],
) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    if salt.len() < 16 {
        return Err("Salt must be at least 16 bytes".into());
    }

    let params = Params::new(ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST, Some(KEY_LEN))
        .map_err(|e| format!("Failed to create Argon2 parameters: {}", e))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(master_password.as_bytes(), salt, &mut key)
        .map_err(|e| format!("Argon2 derivation failed: {}", e))?;

    Ok(Zeroizing::new(key))
}

/// Derives the Auth Verifier (sent to Supabase Auth as the user password).
/// Supabase NEVER receives the raw master password or the master key.
pub fn derive_auth_verifier(master_key: &[u8; KEY_LEN], email: &str) -> Result<String, String> {
    let email_clean = email.trim().to_lowercase();
    let hk = Hkdf::<Sha256>::new(Some(email_clean.as_bytes()), master_key);
    let mut okm = [0u8; KEY_LEN];
    hk.expand(AUTH_VERIFIER_INFO, &mut okm)
        .map_err(|e| format!("HKDF expansion failed: {}", e))?;

    let hex_verifier = hex::encode(okm);
    okm.zeroize();
    Ok(hex_verifier)
}

/// Generates a cryptographically secure random 16-byte salt.
pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Generates a random 24-byte nonce for XChaCha20-Poly1305.
pub fn generate_nonce() -> [u8; NONCE_LEN] {
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Generates a random 32-byte Data Encryption Key (DEK).
pub fn generate_dek() -> Zeroizing<[u8; KEY_LEN]> {
    let mut dek = [0u8; KEY_LEN];
    OsRng.fill_bytes(&mut dek);
    Zeroizing::new(dek)
}

// -----------------------------------------------------------------------------
// RFC 8785 JSON Canonicalization Scheme (JCS)
// -----------------------------------------------------------------------------

/// Canonicalizes any `serde_json::Value` into deterministic RFC 8785 JSON:
/// 1. Lexicographically sorted UTF-8 keys (ASCII code point order).
/// 2. Compact format: no extra whitespace between tokens.
/// 3. Numbers and booleans formatted strictly per specification.
pub fn canonicalize_json(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(b) => {
            if *b {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        serde_json::Value::Number(n) => {
            if !n.is_i64() && !n.is_u64() {
                panic!(
                    "Non-integer numeric values are not supported in PM-Vault Canonical Payload v2"
                );
            }
            n.to_string()
        }
        serde_json::Value::String(s) => {
            serde_json::to_string(s).unwrap_or_else(|_| format!("\"{}\"", s))
        }
        serde_json::Value::Array(arr) => {
            let elems: Vec<String> = arr.iter().map(canonicalize_json).collect();
            format!("[{}]", elems.join(","))
        }
        serde_json::Value::Object(map) => {
            let mut sorted: std::collections::BTreeMap<&str, &serde_json::Value> =
                std::collections::BTreeMap::new();
            for (k, v) in map.iter() {
                sorted.insert(k.as_str(), v);
            }
            let entries: Vec<String> = sorted
                .into_iter()
                .map(|(k, v)| {
                    let k_json = serde_json::to_string(k).unwrap_or_else(|_| format!("\"{}\"", k));
                    format!("{}:{}", k_json, canonicalize_json(v))
                })
                .collect();
            format!("{{{}}}", entries.join(","))
        }
    }
}

// -----------------------------------------------------------------------------
// Domain-Separated Canonical AAD Specifications (V2)
// -----------------------------------------------------------------------------

/// Builds canonical Entry Payload AAD:
/// `pm-vault|entry|crypto=2|schema=2|owner=<owner_uuid>|entry=<entry_uuid>|revision=<u64>|deleted=<0|1>`
pub fn build_entry_aad(
    crypto_version: u32,
    schema_version: u32,
    owner_id: &str,
    entry_id: &str,
    revision: u64,
    is_deleted: bool,
) -> String {
    format!(
        "pm-vault|entry|crypto={}|schema={}|owner={}|entry={}|revision={}|deleted={}",
        crypto_version,
        schema_version,
        owner_id.trim().to_lowercase(),
        entry_id.trim().to_lowercase(),
        revision,
        if is_deleted { 1 } else { 0 }
    )
}

/// Builds canonical Master DEK Wrap AAD:
/// `pm-vault|dek-wrap|master|v2|<owner_uuid>|<key_generation>`
pub fn build_master_dek_aad(owner_id: &str, key_generation: u32) -> String {
    format!(
        "pm-vault|dek-wrap|master|v2|{}|{}",
        owner_id.trim().to_lowercase(),
        key_generation
    )
}

/// Builds canonical Recovery DEK Wrap AAD:
/// `pm-vault|dek-wrap|recovery|v2|<owner_uuid>|<recovery_generation>`
pub fn build_recovery_dek_aad(owner_id: &str, recovery_generation: u32) -> String {
    format!(
        "pm-vault|dek-wrap|recovery|v2|{}|{}",
        owner_id.trim().to_lowercase(),
        recovery_generation
    )
}

// -----------------------------------------------------------------------------
// Recovery Cryptography (Split Secret Architecture)
// -----------------------------------------------------------------------------

/// Generates a random 32-byte offline recovery secret.
pub fn generate_recovery_secret() -> Zeroizing<[u8; KEY_LEN]> {
    let mut secret = [0u8; KEY_LEN];
    OsRng.fill_bytes(&mut secret);
    Zeroizing::new(secret)
}

/// Formats a 32-byte recovery secret into 8 hyphenated 8-char hex blocks.
/// e.g. "A1B2C3D4-E5F67A8B-..."
pub fn format_recovery_code(secret: &[u8; KEY_LEN]) -> String {
    let hex_str = hex::encode(secret);
    let chunks: Vec<String> = hex_str
        .as_bytes()
        .chunks(8)
        .map(|c| std::str::from_utf8(c).unwrap().to_ascii_uppercase())
        .collect();
    chunks.join("-")
}

/// Parses a user-entered recovery code, tolerating dashes, spaces, and case.
pub fn parse_recovery_code(code_str: &str) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let clean: String = code_str.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if clean.len() != 64 {
        return Err(format!(
            "Recovery code must be exactly 64 hex characters (got {})",
            clean.len()
        ));
    }
    let bytes = hex::decode(clean)
        .map_err(|e| format!("Invalid hex characters in recovery code: {}", e))?;
    let mut secret = [0u8; KEY_LEN];
    secret.copy_from_slice(&bytes);
    Ok(Zeroizing::new(secret))
}

pub type RecoveryKeys = (Zeroizing<[u8; KEY_LEN]>, Zeroizing<[u8; KEY_LEN]>, String);

/// Splits the 32-byte RecoverySecret into:
/// 1. REK (Recovery Encryption Key) via HKDF (info = "pm-vault-recovery-wrap-v2")
/// 2. RecoveryAuthToken via HKDF (info = "pm-vault-recovery-auth-v2")
/// 3. RecoveryAuthHash (hex of SHA-256(RecoveryAuthToken)) for server storage
pub fn derive_recovery_keys(
    recovery_secret: &[u8; KEY_LEN],
    user_id: &str,
) -> Result<RecoveryKeys, String> {
    let clean_uid = user_id.trim().to_lowercase();
    let hk = Hkdf::<Sha256>::new(Some(clean_uid.as_bytes()), recovery_secret.as_slice());

    let mut rek = [0u8; KEY_LEN];
    hk.expand(RECOVERY_WRAP_INFO, &mut rek)
        .map_err(|e| format!("HKDF expansion for REK failed: {}", e))?;

    let mut auth_token = [0u8; KEY_LEN];
    hk.expand(RECOVERY_AUTH_INFO, &mut auth_token)
        .map_err(|e| format!("HKDF expansion for RecoveryAuthToken failed: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(auth_token);
    let hash_bytes = hasher.finalize();
    let auth_hash = hex::encode(hash_bytes);

    Ok((Zeroizing::new(rek), Zeroizing::new(auth_token), auth_hash))
}

/// Encrypts DEK using REK and recovery domain AAD.
pub fn encrypt_dek_recovery(
    dek: &[u8; KEY_LEN],
    rek: &[u8; KEY_LEN],
    owner_id: &str,
    recovery_generation: u32,
) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    let cipher = XChaCha20Poly1305::new(rek.into());
    let nonce = generate_nonce();
    let xnonce = XNonce::from_slice(&nonce);
    let aad = build_recovery_dek_aad(owner_id, recovery_generation);

    let payload = Payload {
        msg: dek.as_slice(),
        aad: aad.as_bytes(),
    };

    let ciphertext = cipher
        .encrypt(xnonce, payload)
        .map_err(|e| format!("Recovery DEK encryption failed: {}", e))?;

    Ok((ciphertext, nonce))
}

/// Decrypts DEK using REK and recovery domain AAD.
pub fn decrypt_dek_recovery(
    ciphertext: &[u8],
    nonce: &[u8; NONCE_LEN],
    rek: &[u8; KEY_LEN],
    owner_id: &str,
    recovery_generation: u32,
) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let cipher = XChaCha20Poly1305::new(rek.into());
    let xnonce = XNonce::from_slice(nonce);
    let aad = build_recovery_dek_aad(owner_id, recovery_generation);

    let payload = Payload {
        msg: ciphertext,
        aad: aad.as_bytes(),
    };

    let plaintext = cipher.decrypt(xnonce, payload).map_err(|_| {
        "Failed to decrypt recovery DEK: invalid recovery key or corrupted data".to_string()
    })?;

    if plaintext.len() != KEY_LEN {
        return Err("Decrypted recovery DEK length mismatch".into());
    }

    let mut dek = [0u8; KEY_LEN];
    dek.copy_from_slice(&plaintext);
    Ok(Zeroizing::new(dek))
}

// -----------------------------------------------------------------------------
// Master DEK Wrap & Entry Envelopes (V2)
// -----------------------------------------------------------------------------

/// Encrypts the DEK using the Master Key with V2 domain AAD.
pub fn encrypt_dek_master(
    dek: &[u8; KEY_LEN],
    master_key: &[u8; KEY_LEN],
    owner_id: &str,
    key_generation: u32,
) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    let cipher = XChaCha20Poly1305::new(master_key.into());
    let nonce = generate_nonce();
    let xnonce = XNonce::from_slice(&nonce);
    let aad = build_master_dek_aad(owner_id, key_generation);

    let payload = Payload {
        msg: dek.as_slice(),
        aad: aad.as_bytes(),
    };

    let ciphertext = cipher
        .encrypt(xnonce, payload)
        .map_err(|e| format!("Master DEK encryption failed: {}", e))?;

    Ok((ciphertext, nonce))
}

/// Decrypts the DEK using Master Key with V2 domain AAD.
pub fn decrypt_dek_master(
    ciphertext: &[u8],
    nonce: &[u8; NONCE_LEN],
    master_key: &[u8; KEY_LEN],
    owner_id: &str,
    key_generation: u32,
) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let cipher = XChaCha20Poly1305::new(master_key.into());
    let xnonce = XNonce::from_slice(nonce);
    let aad = build_master_dek_aad(owner_id, key_generation);

    let payload = Payload {
        msg: ciphertext,
        aad: aad.as_bytes(),
    };

    let plaintext = cipher
        .decrypt(xnonce, payload)
        .map_err(|_| "Invalid master password or corrupted DEK (v2)".to_string())?;

    if plaintext.len() != KEY_LEN {
        return Err("Decrypted DEK length mismatch".into());
    }

    let mut dek = [0u8; KEY_LEN];
    dek.copy_from_slice(&plaintext);
    Ok(Zeroizing::new(dek))
}

/// Encrypts an entry payload using the DEK with explicit AAD.
pub fn encrypt_entry_payload(
    plaintext_json: &str,
    dek: &[u8; KEY_LEN],
    aad: &str,
) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    let cipher = XChaCha20Poly1305::new(dek.into());
    let nonce = generate_nonce();
    let xnonce = XNonce::from_slice(&nonce);

    let payload = Payload {
        msg: plaintext_json.as_bytes(),
        aad: aad.as_bytes(),
    };

    let ciphertext = cipher
        .encrypt(xnonce, payload)
        .map_err(|e| format!("Entry encryption failed: {}", e))?;

    Ok((ciphertext, nonce))
}

/// Decrypts an entry ciphertext using the DEK with explicit AAD.
pub fn decrypt_entry_payload(
    ciphertext: &[u8],
    nonce: &[u8; NONCE_LEN],
    dek: &[u8; KEY_LEN],
    aad: &str,
) -> Result<String, String> {
    let cipher = XChaCha20Poly1305::new(dek.into());
    let xnonce = XNonce::from_slice(nonce);

    let payload = Payload {
        msg: ciphertext,
        aad: aad.as_bytes(),
    };

    let plaintext_bytes = cipher.decrypt(xnonce, payload).map_err(|_| {
        "Failed to decrypt entry: authentication tag verification failed".to_string()
    })?;

    String::from_utf8(plaintext_bytes)
        .map_err(|e| format!("Failed to parse decrypted entry as UTF-8: {}", e))
}

// -----------------------------------------------------------------------------
// Legacy V1 Fallbacks (For Backward Compatibility & First-Unlock Migration)
// -----------------------------------------------------------------------------

/// Encrypts the 32-byte DEK with the Master Key using legacy DEK_AAD ("pm:dek:v1").
pub fn encrypt_dek(
    dek: &[u8; KEY_LEN],
    master_key: &[u8; KEY_LEN],
) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    let cipher = XChaCha20Poly1305::new(master_key.into());
    let nonce = generate_nonce();
    let xnonce = XNonce::from_slice(&nonce);

    let payload = Payload {
        msg: dek.as_slice(),
        aad: DEK_AAD_LEGACY_V1,
    };

    let ciphertext = cipher
        .encrypt(xnonce, payload)
        .map_err(|e| format!("DEK encryption failed: {}", e))?;

    Ok((ciphertext, nonce))
}

/// Decrypts the DEK using the Master Key and legacy DEK_AAD ("pm:dek:v1").
pub fn decrypt_dek(
    ciphertext: &[u8],
    nonce: &[u8; NONCE_LEN],
    master_key: &[u8; KEY_LEN],
) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let cipher = XChaCha20Poly1305::new(master_key.into());
    let xnonce = XNonce::from_slice(nonce);

    let payload = Payload {
        msg: ciphertext,
        aad: DEK_AAD_LEGACY_V1,
    };

    let plaintext = cipher
        .decrypt(xnonce, payload)
        .map_err(|_| "Invalid master password or corrupted DEK".to_string())?;

    if plaintext.len() != KEY_LEN {
        return Err("Decrypted DEK length mismatch".into());
    }

    let mut dek = [0u8; KEY_LEN];
    dek.copy_from_slice(&plaintext);
    Ok(Zeroizing::new(dek))
}

/// Legacy entry encryption with entry_id as AAD.
#[allow(dead_code)]
pub fn encrypt_entry(
    plaintext_json: &str,
    dek: &[u8; KEY_LEN],
    entry_id: &str,
) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    encrypt_entry_payload(plaintext_json, dek, entry_id)
}

/// Legacy entry decryption with entry_id as AAD.
#[allow(dead_code)]
pub fn decrypt_entry(
    ciphertext: &[u8],
    nonce: &[u8; NONCE_LEN],
    dek: &[u8; KEY_LEN],
    entry_id: &str,
) -> Result<String, String> {
    decrypt_entry_payload(ciphertext, nonce, dek, entry_id)
}

/// Cryptographically secure password generator.
pub fn generate_password(
    length: usize,
    uppercase: bool,
    lowercase: bool,
    numbers: bool,
    symbols: bool,
) -> String {
    let mut charset: Vec<char> = Vec::new();

    if uppercase {
        charset.extend("ABCDEFGHJKLMNPQRSTUVWXYZ".chars()); // Excludes ambiguous 'I', 'O'
    }
    if lowercase {
        charset.extend("abcdefghijkmnopqrstuvwxyz".chars()); // Excludes ambiguous 'l'
    }
    if numbers {
        charset.extend("23456789".chars()); // Excludes '0', '1'
    }
    if symbols {
        charset.extend("!@#$%^&*()-_=+[]{}|;:,.<>?".chars());
    }

    if charset.is_empty() {
        charset.extend("abcdefghjkmnpqrstuvwxyz23456789".chars());
    }

    let mut password = String::with_capacity(length);
    for _ in 0..length {
        let idx = (OsRng.next_u32() as usize) % charset.len();
        password.push(charset[idx]);
    }

    password
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crypto_roundtrip_legacy() {
        let master_pwd = "CorrectHorseBatteryStaple!";
        let salt = generate_salt();

        let mk = derive_master_key(master_pwd, &salt).expect("MK derivation failed");
        let dek = generate_dek();

        // Encrypt & Decrypt DEK (legacy)
        let (enc_dek, dek_nonce) = encrypt_dek(&dek, &mk).expect("DEK encryption failed");
        let decrypted_dek = decrypt_dek(&enc_dek, &dek_nonce, &mk).expect("DEK decryption failed");
        assert_eq!(*dek, *decrypted_dek);

        // Encrypt & Decrypt Entry (legacy)
        let entry_id = "550e8400-e29b-41d4-a716-446655440000";
        let plaintext = r#"{"title":"GitHub","password":"SuperSecret123!"}"#;

        let (ct, nonce) =
            encrypt_entry(plaintext, &decrypted_dek, entry_id).expect("Encrypt entry");
        let pt = decrypt_entry(&ct, &nonce, &decrypted_dek, entry_id).expect("Decrypt entry");
        assert_eq!(plaintext, pt);

        // Auth verifier consistency
        let verifier1 = derive_auth_verifier(&mk, "user@example.com").expect("Auth verifier");
        let verifier2 = derive_auth_verifier(&mk, "USER@EXAMPLE.COM ").expect("Auth verifier");
        assert_eq!(verifier1, verifier2);
    }

    #[test]
    fn test_canonicalize_json() {
        let raw_json = r#"{
            "title": "GitHub",
            "url": "https://github.com",
            "tags": ["personal", "work"],
            "notes": null,
            "security_questions": [
                {
                    "question": "What was the name of your first pet?",
                    "answer": "VelvetFalcon#8829"
                }
            ],
            "schema_version": 2,
            "favorite": false,
            "password": "ExamplePassword123!",
            "username": "user@example.com"
        }"#;

        let val: serde_json::Value = serde_json::from_str(raw_json).unwrap();
        let canonical = canonicalize_json(&val);

        let expected = "{\"favorite\":false,\"notes\":null,\"password\":\"ExamplePassword123!\",\"schema_version\":2,\"security_questions\":[{\"answer\":\"VelvetFalcon#8829\",\"question\":\"What was the name of your first pet?\"}],\"tags\":[\"personal\",\"work\"],\"title\":\"GitHub\",\"url\":\"https://github.com\",\"username\":\"user@example.com\"}";
        assert_eq!(canonical, expected);
    }

    #[test]
    fn test_aad_and_v2_encryption_roundtrip() {
        let owner_id = "7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c";
        let entry_id = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
        let revision = 12u64;
        let is_deleted = false;

        let aad = build_entry_aad(2, 2, owner_id, entry_id, revision, is_deleted);
        assert_eq!(
            aad,
            "pm-vault|entry|crypto=2|schema=2|owner=7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c|entry=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d|revision=12|deleted=0"
        );

        let dek = generate_dek();
        let payload = r#"{"favorite":true,"title":"VaultTest"}"#;

        let (ct, nonce) = encrypt_entry_payload(payload, &dek, &aad).expect("Encryption failed");
        let decrypted = decrypt_entry_payload(&ct, &nonce, &dek, &aad).expect("Decryption failed");
        assert_eq!(payload, decrypted);

        // AAD Tampering test: revision changed from 12 to 13
        let tampered_aad = build_entry_aad(2, 2, owner_id, entry_id, 13, is_deleted);
        let tamper_result = decrypt_entry_payload(&ct, &nonce, &dek, &tampered_aad);
        assert!(
            tamper_result.is_err(),
            "Decryption MUST fail if revision or any AAD field is tampered"
        );
    }

    #[test]
    fn test_split_recovery_architecture() {
        let user_id = "7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c";
        let secret = generate_recovery_secret();
        let formatted = format_recovery_code(&secret);
        assert_eq!(formatted.len(), 71); // 64 chars + 7 hyphens

        let parsed_secret = parse_recovery_code(&formatted).expect("Parse recovery code");
        assert_eq!(*secret, *parsed_secret);

        let (rek, auth_token, auth_hash) =
            derive_recovery_keys(&secret, user_id).expect("Derive recovery keys");
        assert_ne!(*rek, *auth_token);
        assert_eq!(auth_hash.len(), 64);

        let dek = generate_dek();
        let (enc_dek, nonce) =
            encrypt_dek_recovery(&dek, &rek, user_id, 1).expect("Recovery wrap DEK");
        let recovered_dek =
            decrypt_dek_recovery(&enc_dek, &nonce, &rek, user_id, 1).expect("Recovery unwrap DEK");
        assert_eq!(*dek, *recovered_dek);

        // Tampering generation fails closed
        let failed_unwrap = decrypt_dek_recovery(&enc_dek, &nonce, &rek, user_id, 2);
        assert!(failed_unwrap.is_err());
    }

    #[test]
    fn test_master_dek_wrap_v2() {
        let owner_id = "7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c";
        let master_key = derive_master_key("Passphrase123!", &generate_salt()).unwrap();
        let dek = generate_dek();

        let (enc_dek, nonce) = encrypt_dek_master(&dek, &master_key, owner_id, 1).unwrap();
        let decrypted = decrypt_dek_master(&enc_dek, &nonce, &master_key, owner_id, 1).unwrap();
        assert_eq!(*dek, *decrypted);

        // Tampering generation fails closed
        let tampered = decrypt_dek_master(&enc_dek, &nonce, &master_key, owner_id, 2);
        assert!(tampered.is_err());
    }
}
