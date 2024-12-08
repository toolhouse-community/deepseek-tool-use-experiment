from hypercorn.config import Config

config = Config()
config.bind = ["0.0.0.0:8000"]
config.alpn_protocols = ["h2"]
config.certfile = "cert.pem"
config.keyfile = "key.pem"
config.ssl = "TLS"
