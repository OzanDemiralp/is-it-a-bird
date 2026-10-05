from app.core import errors


def test_every_error_has_unique_code_and_name():
    subclasses = [c for c in vars(errors).values() if isinstance(c, type) and issubclass(c, errors.AppError) and c is not errors.AppError]
    codes = [c.code for c in subclasses]
    assert len(codes) == len(set(codes))
    assert all(c().name == c.__name__ for c in subclasses)


def test_custom_message_and_details_override_defaults():
    err = errors.OpenSkyBadResponseError("custom", details={"x": 1})
    assert err.message == "custom"
    assert err.details == {"x": 1}
