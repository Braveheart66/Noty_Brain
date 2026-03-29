from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
	email = models.EmailField(unique=True)
	display_name = models.CharField(max_length=150, blank=True)
	avatar_url = models.URLField(blank=True)

	USERNAME_FIELD = "email"
	REQUIRED_FIELDS = ["username"]

	def __str__(self) -> str:
		return self.email
