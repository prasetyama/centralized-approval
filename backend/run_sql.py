import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

sql = """
CREATE TABLE `user_title_matrix` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `dept` varchar(50) NOT NULL,
  `title` varchar(50) NOT NULL,
  `email` varchar(254) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_title_matrix_user_id_role_id_uniq` (`email`,`title`),
  KEY `user_title_matrix_title_fk_aw_role_code` (`title`),
  CONSTRAINT `user_title_matrix_title_fk` FOREIGN KEY (`title`) REFERENCES `aw_role` (`code`),
  CONSTRAINT `user_title_matrix_email_fk` FOREIGN KEY (`email`) REFERENCES `aw_user` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
"""

with connection.cursor() as cursor:
    try:
        cursor.execute(sql)
        print("Table created manually.")
    except Exception as e:
        print("Error:", e)
