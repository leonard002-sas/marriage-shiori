variable "aws_region" {
  type    = string
  default = "ap-northeast-1"
}

variable "project_name" {
  type    = string
  default = "marriage-shiori"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "github_repository" {
  type    = string
  default = "leonard002-sas/marriage-shiori"
}

variable "github_branch" {
  type    = string
  default = "test-branch"
}
