from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import aircraft, health
from .core import config
from .core.handlers import register_exception_handlers

app = FastAPI(title="Is It A Bird? API")

# No cookies/credentials are used, so credentials stay off; only GET is needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(health.router)
app.include_router(aircraft.router)