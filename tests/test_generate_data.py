import contextlib
import datetime
import io
import unittest
import urllib.error
from unittest.mock import patch

import generate_data


class GeneratorTests(unittest.TestCase):
    def test_request_uses_configured_url_auth_and_timeout(self):
        with patch('generate_data.urllib.request.urlopen') as urlopen:
            urlopen.return_value.__enter__.return_value.read.return_value = b'{"id": 1}'
            result = generate_data.request('POST', '/categories', {}, 'demo-token',
                                           api_base='http://localhost:8098/')
        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, 'http://localhost:8098/categories')
        self.assertEqual(request.get_header('Authorization'), 'Bearer demo-token')
        self.assertEqual(request.data, b'{}')
        self.assertEqual(urlopen.call_args.kwargs['timeout'], 30)
        self.assertEqual(result, {'id': 1})

    def test_http_errors_report_endpoint_and_status(self):
        error = urllib.error.HTTPError('http://localhost:8098/users', 503,
                                       'Unavailable', {}, io.BytesIO(b'database unavailable'))
        with patch('generate_data.urllib.request.urlopen', side_effect=error):
            with self.assertRaisesRegex(RuntimeError, 'POST .*users: HTTP 503: database unavailable'):
                generate_data.request('POST', '/users')

    def test_missing_token_stops_before_creating_categories(self):
        with patch('generate_data.request', return_value={}) as request:
            with contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(RuntimeError, 'did not return a token'):
                    generate_data.main([])
        self.assertEqual(request.call_count, 1)

    def test_generation_handles_leap_day_and_preserves_utc(self):
        now = datetime.datetime(2024, 3, 1, 12, tzinfo=datetime.timezone.utc)

        class FixedDateTime(datetime.datetime):
            @classmethod
            def now(cls, tz=None):
                self.assertEqual(tz, datetime.timezone.utc)
                return now

        transactions = []

        def fake_request(method, path, payload=None, token=None, **kwargs):
            self.assertEqual(kwargs['api_base'], 'http://localhost:9000')
            if path == '/users':
                return {'token': 'demo-token'}
            self.assertEqual(token, 'demo-token')
            if path in ('/incomes', '/expenses'):
                transactions.append(payload)
            return {'id': 1}

        with patch('generate_data.request', side_effect=fake_request):
            with patch('generate_data.datetime.datetime', FixedDateTime):
                with contextlib.redirect_stdout(io.StringIO()):
                    generate_data.main(['--api-url', 'http://localhost:9000', '--days', '2', '--seed', '1'])

        timestamps = [row.get('spent_on', row.get('received_on')) for row in transactions]
        self.assertEqual({stamp[:10] for stamp in timestamps}, {'2024-02-29', '2024-03-01'})
        self.assertTrue(all(stamp.endswith('T12:00:00Z') for stamp in timestamps))
        self.assertTrue(all(row['amount'] > 0 for row in transactions))


if __name__ == '__main__':
    unittest.main()
