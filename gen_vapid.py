from pywebpush import Vapid

def generate_keys():
    v = Vapid()
    # This generates a new private key internally
    private_key = v.private_key_base64
    public_key = v.public_key_base64
    print(f"VAPID_PRIVATE_KEY={private_key}")
    print(f"VAPID_PUBLIC_KEY={public_key}")

if __name__ == "__main__":
    generate_keys()
