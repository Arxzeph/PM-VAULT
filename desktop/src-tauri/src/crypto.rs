use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    XChaCha20Poly1305, XNonce,
};
use hkdf::Hkdf;
use rand::{rngs::OsRng, RngCore};
use sha2::Sha256;
use zeroize::{Zeroize, Zeroizing};

// Cryptographic constants locked per BUILD_PLAN.md
pub const ARGON2_M_COST: u32 = 65536; // 64 MiB
pub const ARGON2_T_COST: u32 = 3;     // 3 iterations
pub const ARGON2_P_COST: u32 = 4;     // 4 parallelism
pub const SALT_LEN: usize = 16;
pub const KEY_LEN: usize = 32;
pub const NONCE_LEN: usize = 24;

pub const DEK_AAD: &[u8] = b"pm:dek:v1";
pub const AUTH_VERIFIER_INFO: &[u8] = b"pm:auth:supabase_password";

/// Derives the 32-byte Master Key (MK) using Argon2id.
pub fn derive_master_key(master_password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
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

/// Encrypts the 32-byte DEK with the Master Key using XChaCha20-Poly1305.
pub fn encrypt_dek(
    dek: &[u8; KEY_LEN],
    master_key: &[u8; KEY_LEN],
) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    let cipher = XChaCha20Poly1305::new(master_key.into());
    let nonce = generate_nonce();
    let xnonce = XNonce::from_slice(&nonce);

    let payload = Payload {
        msg: dek.as_slice(),
        aad: DEK_AAD,
    };

    let ciphertext = cipher
        .encrypt(xnonce, payload)
        .map_err(|e| format!("DEK encryption failed: {}", e))?;

    Ok((ciphertext, nonce))
}

/// Decrypts the DEK using the Master Key.
pub fn decrypt_dek(
    ciphertext: &[u8],
    nonce: &[u8; NONCE_LEN],
    master_key: &[u8; KEY_LEN],
) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let cipher = XChaCha20Poly1305::new(master_key.into());
    let xnonce = XNonce::from_slice(nonce);

    let payload = Payload {
        msg: ciphertext,
        aad: DEK_AAD,
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

/// Encrypts an entry payload using the DEK with entry_id as AAD.
pub fn encrypt_entry(
    plaintext_json: &str,
    dek: &[u8; KEY_LEN],
    entry_id: &str,
) -> Result<(Vec<u8>, [u8; NONCE_LEN]), String> {
    let cipher = XChaCha20Poly1305::new(dek.into());
    let nonce = generate_nonce();
    let xnonce = XNonce::from_slice(&nonce);

    let payload = Payload {
        msg: plaintext_json.as_bytes(),
        aad: entry_id.as_bytes(),
    };

    let ciphertext = cipher
        .encrypt(xnonce, payload)
        .map_err(|e| format!("Entry encryption failed: {}", e))?;

    Ok((ciphertext, nonce))
}

/// Decrypts an entry ciphertext using the DEK.
pub fn decrypt_entry(
    ciphertext: &[u8],
    nonce: &[u8; NONCE_LEN],
    dek: &[u8; KEY_LEN],
    entry_id: &str,
) -> Result<String, String> {
    let cipher = XChaCha20Poly1305::new(dek.into());
    let xnonce = XNonce::from_slice(nonce);

    let payload = Payload {
        msg: ciphertext,
        aad: entry_id.as_bytes(),
    };

    let plaintext_bytes = cipher
        .decrypt(xnonce, payload)
        .map_err(|_| "Failed to decrypt entry: authentication tag verification failed".to_string())?;

    String::from_utf8(plaintext_bytes)
        .map_err(|e| format!("Failed to parse decrypted entry as UTF-8: {}", e))
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
    fn test_crypto_roundtrip() {
        let master_pwd = "CorrectHorseBatteryStaple!";
        let salt = generate_salt();

        let mk = derive_master_key(master_pwd, &salt).expect("MK derivation failed");
        let dek = generate_dek();

        // Encrypt & Decrypt DEK
        let (enc_dek, dek_nonce) = encrypt_dek(&dek, &mk).expect("DEK encryption failed");
        let decrypted_dek = decrypt_dek(&enc_dek, &dek_nonce, &mk).expect("DEK decryption failed");
        assert_eq!(*dek, *decrypted_dek);

        // Encrypt & Decrypt Entry
        let entry_id = "550e8400-e29b-41d4-a716-446655440000";
        let plaintext = r#"{"title":"GitHub","password":"SuperSecret123!"}"#;

        let (ct, nonce) = encrypt_entry(plaintext, &decrypted_dek, entry_id).expect("Encrypt entry");
        let pt = decrypt_entry(&ct, &nonce, &decrypted_dek, entry_id).expect("Decrypt entry");
        assert_eq!(plaintext, pt);

        // Auth verifier consistency
        let verifier1 = derive_auth_verifier(&mk, "user@example.com").expect("Auth verifier");
        let verifier2 = derive_auth_verifier(&mk, "USER@EXAMPLE.COM ").expect("Auth verifier");
        assert_eq!(verifier1, verifier2);
    }
}
