from src.cli import write_github_output


def test_write_github_output_uses_lowercase_for_booleans(tmp_path, monkeypatch):
    output_path = tmp_path / "github_output.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output_path))

    write_github_output(changed=True, count=3, label="ok")

    assert output_path.read_text(encoding="utf-8") == (
        "changed=true\ncount=3\nlabel=ok\n"
    )
