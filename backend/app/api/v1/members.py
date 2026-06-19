from fastapi import APIRouter

router = APIRouter(prefix="/members", tags=["members"])

# TODO: GET / — list members (board+ only)
# TODO: GET /{member_id} — get member profile
# TODO: PATCH /{member_id}/approve — approve pending member (board+ only)
# TODO: PATCH /{member_id}/reject — reject pending member (board+ only)
# TODO: PATCH /{member_id}/role — update member role (president only)
