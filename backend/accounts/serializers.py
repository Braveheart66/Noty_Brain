from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "email", "password", "display_name")
        read_only_fields = ("id",)

    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data.pop("password")
        display_name = validated_data.get("display_name", "")
        base_username = email.split("@", 1)[0].strip().lower() or "user"
        username = base_username[:150]
        suffix = 1
        while User.objects.filter(username=username).exists():
            suffix_text = f"_{suffix}"
            username = f"{base_username[: 150 - len(suffix_text)]}{suffix_text}"
            suffix += 1

        user = User(
            username=username,
            email=email,
            display_name=display_name,
        )
        user.set_password(password)
        user.save()
        return user


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "display_name", "avatar_url", "date_joined")
        read_only_fields = ("id", "username", "email", "date_joined")
