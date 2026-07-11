# ============================================================
# Iron Empire — Terraform Infrastructure
# Provisions an EC2 instance + RDS MySQL on AWS
# ============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---- Variables ----

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "db_password" {
  description = "Password for the RDS MySQL instance"
  type        = string
  sensitive   = true
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID to deploy into"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for the EC2 instance"
  type        = string
}

variable "db_subnet_group" {
  description = "DB subnet group name for RDS"
  type        = string
}

# ---- Security Group ----

resource "aws_security_group" "iron_empire_sg" {
  name        = "iron-empire-sg"
  description = "Allow HTTP, HTTPS, SSH, and MySQL traffic"
  vpc_id      = var.vpc_id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "App port"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "iron-empire-sg"
    Project = "iron-empire"
  }
}

resource "aws_security_group" "iron_empire_rds_sg" {
  name        = "iron-empire-rds-sg"
  description = "Allow MySQL from app security group"
  vpc_id      = var.vpc_id

  ingress {
    description     = "MySQL from app"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.iron_empire_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "iron-empire-rds-sg"
    Project = "iron-empire"
  }
}

# ---- EC2 Instance ----

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "iron_empire_app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.micro"
  key_name               = var.key_pair_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.iron_empire_sg.id]

  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Install Docker
    yum update -y
    yum install -y docker
    systemctl enable docker
    systemctl start docker

    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
      -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose

    # Add ec2-user to docker group
    usermod -aG docker ec2-user
  EOF

  tags = {
    Name    = "iron-empire-app"
    Project = "iron-empire"
  }
}

# ---- RDS MySQL Instance ----

resource "aws_db_instance" "iron_empire_db" {
  identifier     = "iron-empire-db"
  engine         = "mysql"
  engine_version = "8.0"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_type          = "gp3"

  db_name  = "iron_empire"
  username = "iron_empire_admin"
  password = var.db_password

  db_subnet_group_name   = var.db_subnet_group
  vpc_security_group_ids = [aws_security_group.iron_empire_rds_sg.id]

  multi_az            = false
  publicly_accessible = false
  skip_final_snapshot = true

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  tags = {
    Name    = "iron-empire-db"
    Project = "iron-empire"
  }
}

# ---- Outputs ----

output "app_public_ip" {
  description = "Public IP of the EC2 instance"
  value       = aws_instance.iron_empire_app.public_ip
}

output "rds_endpoint" {
  description = "RDS MySQL endpoint"
  value       = aws_db_instance.iron_empire_db.endpoint
}

output "rds_port" {
  description = "RDS MySQL port"
  value       = aws_db_instance.iron_empire_db.port
}
