
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('slug', models.SlugField(max_length=60, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'tag',
                'verbose_name_plural': 'tags',
                'db_table': 'posts_tag',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Post',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=300)),
                ('body_markdown', models.TextField(blank=True)),
                ('body_html', models.TextField(blank=True, editable=False)),
                ('kind', models.CharField(choices=[('text', 'Text'), ('image', 'Image'), ('video', 'Video'), ('link', 'Link')], default='text', max_length=10)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('processing', 'Processing'), ('published', 'Published'), ('removed', 'Removed')], db_index=True, default='draft', max_length=20)),
                ('link_url', models.URLField(blank=True, max_length=2000)),
                ('slug', models.SlugField(blank=True, max_length=120, unique=True)),
                ('published_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('author', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='posts', to=settings.AUTH_USER_MODEL)),
                ('tags', models.ManyToManyField(blank=True, related_name='posts', to='posts.tag')),
            ],
            options={
                'verbose_name': 'post',
                'verbose_name_plural': 'posts',
                'db_table': 'posts_post',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Media',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('image', 'Image'), ('video', 'Video'), ('gif', 'GIF')], max_length=10)),
                ('file', models.FileField(upload_to='posts/media/')),
                ('thumbnail', models.ImageField(blank=True, null=True, upload_to='posts/thumbs/')),
                ('mime_type', models.CharField(max_length=100)),
                ('file_size', models.PositiveBigIntegerField(default=0)),
                ('width', models.PositiveIntegerField(blank=True, null=True)),
                ('height', models.PositiveIntegerField(blank=True, null=True)),
                ('duration_seconds', models.FloatField(blank=True, null=True)),
                ('processing_status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('done', 'Done'), ('failed', 'Failed')], db_index=True, default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='media', to='posts.post')),
            ],
            options={
                'verbose_name': 'media',
                'verbose_name_plural': 'media',
                'db_table': 'posts_media',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='post',
            index=models.Index(fields=['status', 'published_at'], name='posts_post_status_384c95_idx'),
        ),
        migrations.AddIndex(
            model_name='post',
            index=models.Index(fields=['author', 'status'], name='posts_post_author__216072_idx'),
        ),
    ]
