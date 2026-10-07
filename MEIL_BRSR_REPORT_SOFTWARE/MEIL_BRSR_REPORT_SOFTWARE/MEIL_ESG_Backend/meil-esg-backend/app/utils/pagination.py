from flask import request


def paginate(query, default_size=25, max_size=100):
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        size = min(max_size, max(1, int(request.args.get("pageSize", default_size))))
    except (TypeError, ValueError):
        size = default_size
    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return items, {"page": page, "pageSize": size, "total": total, "totalPages": max(1, -(-total // size))}
