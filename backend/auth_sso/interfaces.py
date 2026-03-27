"""
Auth Interface
==============
Abstract authentication interface for SSO providers.
Implements the Strategy pattern for swappable auth backends.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class AuthResult:
    """Result of an authentication attempt."""
    success: bool
    user_id: Optional[int] = None
    token: Optional[str] = None
    error: Optional[str] = None
    expires_in: Optional[int] = None  # seconds


class AuthInterface(ABC):
    """
    Abstract authentication interface.
    All SSO providers must implement this interface.
    Enables swapping between Mock, OAuth, OIDC etc. without changing consumer code.
    """

    @abstractmethod
    def authenticate(self, username: str, password: str) -> AuthResult:
        """
        Authenticate a user with credentials.

        Args:
            username: User's username.
            password: User's password.

        Returns:
            AuthResult with token if successful.
        """
        pass

    @abstractmethod
    def validate_token(self, token: str) -> Optional[dict]:
        """
        Validate an existing token and return user data.

        Args:
            token: JWT or access token string.

        Returns:
            Dict with user data if valid, None if invalid.
        """
        pass

    @abstractmethod
    def logout(self, token: str) -> bool:
        """
        Invalidate a token (logout).

        Args:
            token: Token to invalidate.

        Returns:
            True if successfully logged out.
        """
        pass
