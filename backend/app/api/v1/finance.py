from fastapi import APIRouter

router = APIRouter(prefix="/finance", tags=["finance"])

# TODO: GET /transactions — list transactions (treasurer+ only)
# TODO: POST /transactions — record a transaction (treasurer+ only)
# TODO: GET /summary — financial summary / balance (treasurer+ only)
# TODO: GET /reports — generate financial report (treasurer+ only)
