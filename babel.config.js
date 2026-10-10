module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Nhúng nội dung file .sql (migration do drizzle-kit sinh ra) thành chuỗi khi bundle.
    // Sửa schema + generate migration xong nhớ chạy `npx expo start -c` để xoá cache Babel.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
