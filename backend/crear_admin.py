from pymongo import MongoClient
import bcrypt

h = bcrypt.hashpw(b'AdminHemsa2026!', bcrypt.gensalt()).decode()
MongoClient('mongodb://localhost:27017')['hemsa_local'].users.update_one(
    {'email': 'admin@hemsa.es'},
    {'$set': {
        'email': 'admin@hemsa.es',
        'name': 'Administrador Hemsa',
        'role': 'admin',
        'admin_level': 'gerente',
        'auth_provider': 'password',
        'password_hash': h,
        'disabled': False,
        'user_id': 'user_seed_admin',
    }},
    upsert=True,
)
print('OK · admin@hemsa.es / AdminHemsa2026!')