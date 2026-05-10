# Generated migration: allow mime_type to be blank (auto-detected on save)
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0006_toxicity_postview"),
    ]

    operations = [
        migrations.AlterField(
            model_name="media",
            name="mime_type",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
