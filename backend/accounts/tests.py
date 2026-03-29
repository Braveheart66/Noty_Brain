from rest_framework import status
from rest_framework.test import APITestCase


class AccountsApiTests(APITestCase):
	def test_register_creates_user(self):
		response = self.client.post(
			"/api/auth/register/",
			{
				"email": "alice@example.com",
				"password": "strong-password-123",
				"display_name": "Alice",
			},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data["email"], "alice@example.com")

	def test_register_allows_same_local_part_different_domain(self):
		first = self.client.post(
			"/api/auth/register/",
			{
				"email": "dev@example.com",
				"password": "strong-password-123",
				"display_name": "Dev One",
			},
			format="json",
		)
		second = self.client.post(
			"/api/auth/register/",
			{
				"email": "dev@another.com",
				"password": "strong-password-123",
				"display_name": "Dev Two",
			},
			format="json",
		)

		self.assertEqual(first.status_code, status.HTTP_201_CREATED)
		self.assertEqual(second.status_code, status.HTTP_201_CREATED)
