import hmac, hashlib
from app.services.payment import PaymentService

def _sig(order, pay, secret):
    return hmac.new(secret.encode(), f"{order}|{pay}".encode(), hashlib.sha256).hexdigest()

def test_valid_signature_true():
    assert PaymentService.signature_is_valid("o1", "p1", _sig("o1","p1","sek"), "sek") is True

def test_tampered_signature_false():
    assert PaymentService.signature_is_valid("o1", "p1", "deadbeef", "sek") is False

def test_amounts_match_exact():
    assert PaymentService.amounts_match(200.0, 200.0) is True

def test_amounts_mismatch():
    assert PaymentService.amounts_match(200.0, 1.0) is False
