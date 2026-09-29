output "frontend_bucket_name" { value = aws_s3_bucket.frontend.bucket }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.frontend.id }
output "cloudfront_domain_name" { value = aws_cloudfront_distribution.frontend.domain_name }
output "github_connection_arn" { value = aws_codestarconnections_connection.github.arn }
output "cognito_user_pool_id" { value = aws_cognito_user_pool.users.id }
output "cognito_client_id" { value = aws_cognito_user_pool_client.web.id }
output "user_assets_bucket_name" { value = aws_s3_bucket.user_assets.bucket }
output "api_endpoint" { value = aws_apigatewayv2_api.api.api_endpoint }
