from flask import Flask, request, jsonify
from flask_cors import CORS
import jwt
import datetime

app = Flask(__name__)
CORS(app)

# Chave secreta para JWT (em produção, use uma chave segura)
SECRET_KEY = "your-secret-key-here"

# Usuários de exemplo (em produção, use um banco de dados)
USERS = {
    "accounts@mymetric.com.br": {
        "password": "Z5RDqlkDOk0SP65",
        "name": "Contas MyMetric",
        "id": "1"
    }
}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email e senha são obrigatórios"
        }), 400
    
    # Verificar credenciais
    if email in USERS and USERS[email]['password'] == password:
        # Gerar token JWT
        token = jwt.encode({
            'user_id': USERS[email]['id'],
            'email': email,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            "access_token": token,
            "token_type": "bearer"
        })
    else:
        return jsonify({
            "success": False,
            "message": "Email ou senha incorretos"
        }), 401

@app.route('/validate-token', methods=['POST'])
def validate_token():
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"valid": False}), 401
    
    token = auth_header.split(' ')[1]
    
    try:
        # Decodificar token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return jsonify({"valid": True, "user": payload}), 200
    except jwt.ExpiredSignatureError:
        return jsonify({"valid": False, "message": "Token expirado"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"valid": False, "message": "Token inválido"}), 401

@app.route('/profile', methods=['GET'])
def get_profile():
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Token de autorização necessário"}), 401
    
    token = auth_header.split(' ')[1]
    
    try:
        # Decodificar token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        email = payload.get('sub')
        
        if email in USERS:
            user = USERS[email]
            # Simular diferentes tipos de acesso baseado no email
            if email == "accounts@mymetric.com.br":
                access_control = "all"
                tablename = "all"
            else:
                access_control = "read"
                tablename = "user_metrics"
                
            return jsonify({
                "email": email,
                "admin": False,
                "access_control": access_control,
                "tablename": tablename
            })
        else:
            return jsonify({"error": "Usuário não encontrado"}), 404
            
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expirado"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Token inválido"}), 401

@app.route('/metrics/basic-data', methods=['POST'])
def get_basic_metrics():
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Token de autorização necessário"}), 401
    
    token = auth_header.split(' ')[1]
    
    try:
        # Decodificar token
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        data = request.get_json()
        
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        table_name = data.get('table_name')
        
        if not all([start_date, end_date, table_name]):
            return jsonify({"error": "start_date, end_date e table_name são obrigatórios"}), 400
        
        # Simular dados de métricas baseados na tabela
        if table_name == 'coffeemais':
            metrics_data = {
                "total_sales": 125000,
                "total_orders": 1250,
                "average_order_value": 100.0,
                "customer_count": 450,
                "growth_rate": 12.5,
                "period": f"{start_date} a {end_date}",
                "table_name": table_name
            }
        elif table_name == 'constance':
            metrics_data = {
                "total_sales": 890000,
                "total_orders": 89,
                "average_order_value": 10000.0,
                "customer_count": 25,
                "growth_rate": 8.3,
                "period": f"{start_date} a {end_date}",
                "table_name": table_name
            }
        elif table_name == 'gringa':
            metrics_data = {
                "total_sales": 75000,
                "total_orders": 750,
                "average_order_value": 100.0,
                "customer_count": 300,
                "growth_rate": 15.2,
                "period": f"{start_date} a {end_date}",
                "table_name": table_name
            }
        elif table_name == 'bocarosa':
            metrics_data = {
                "total_sales": 95000,
                "total_orders": 950,
                "average_order_value": 100.0,
                "customer_count": 380,
                "growth_rate": 18.7,
                "period": f"{start_date} a {end_date}",
                "table_name": table_name
            }
        else:
            metrics_data = {
                "total_sales": 50000,
                "total_orders": 500,
                "average_order_value": 100.0,
                "customer_count": 200,
                "growth_rate": 5.2,
                "period": f"{start_date} a {end_date}",
                "table_name": table_name
            }
        
        return jsonify(metrics_data)
        
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expirado"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Token inválido"}), 401

if __name__ == '__main__':
    app.run(debug=True, port=8000) 