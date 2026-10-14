from pydantic import BaseModel


class ExportTaskOut(BaseModel):
    task_id: str
    status: str
    format: str | None = None
    file_name: str | None = None
    download_url: str | None = None
    error: str | None = None
