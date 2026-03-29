from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
	model = User
	list_display = ("email", "username", "display_name", "is_staff", "is_active")
	ordering = ("email",)
	fieldsets = UserAdmin.fieldsets + (("Profile", {"fields": ("display_name", "avatar_url")}),)
