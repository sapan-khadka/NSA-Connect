from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])

# TODO: POST /register — member registration with hashed password
# TODO: POST /login — authenticate and return JWT access token
# TODO: POST /logout — invalidate session / token
# TODO: GET /me — return current authenticated member
