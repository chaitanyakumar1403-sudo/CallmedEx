"""
Unit tests for app.services.storage.StorageService (bucket auto-creation & magic bytes validation).
"""
from unittest.mock import MagicMock
import pytest

from app.services.storage import StorageService, validate_magic_bytes


def test_validate_magic_bytes_pdf():
    valid_pdf = b"%PDF-1.4 header text"
    assert validate_magic_bytes(valid_pdf, "pdf") is True
    assert validate_magic_bytes(valid_pdf, "png") is False


def test_validate_magic_bytes_png():
    valid_png = b"\x89PNG\r\n\x1a\nfake png"
    assert validate_magic_bytes(valid_png, "png") is True
    assert validate_magic_bytes(valid_png, "jpg") is False


def test_upload_document_auto_creates_missing_bucket(monkeypatch):
    """
    Verify that when storage returns 404 (bucket not found), upload_document
    attempts to create the bucket and retries upload.
    """
    mock_storage = MagicMock()
    mock_from = MagicMock()
    
    # First upload call raises 404
    first_upload = MagicMock(side_effect=Exception("{'statusCode': 404, 'error': 'Bucket not found'}"))
    second_upload = MagicMock(return_value={"path": "user/test.pdf"})
    
    mock_from.upload.side_effect = [first_upload.side_effect, second_upload.return_value]
    mock_storage.from_.return_value = mock_from

    fake_supabase = MagicMock()
    fake_supabase.storage = mock_storage

    monkeypatch.setattr("app.services.storage.supabase", fake_supabase)

    pdf_bytes = b"%PDF-1.7 header"
    result = StorageService.upload_document("test_user_123", pdf_bytes, "pdf", bucket="new-reports-bucket")

    assert result != ""
    assert result.startswith("test_user_123/")
    assert result.endswith(".pdf")
    
    # Verify create_bucket was called once
    mock_storage.create_bucket.assert_called_once_with("new-reports-bucket", options={"public": False})
