import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  CircularProgress, 
  Alert, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Pagination,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Checkbox,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import { useMeta } from '../hooks/useMeta';
import { listTextures, getPreviewUrl, uploadTexture } from '../api/texture';
import type { TextureItem, TextureListRequest, TextureType, SkinModel } from '../types/texture';
import { getAuthToken, getUid } from '../utils/cookie';
import { SkinlibUrl, setSkinlibUrl } from '../utils/config';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UploadDialog: React.FC<UploadDialogProps> = ({ open, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TextureType>('skin');
  const [model, setModel] = useState<SkinModel>('default');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityConfirmed, setSecurityConfirmed] = useState(false);

  const isCustomUrl = !!SkinlibUrl;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'image/png') {
        setError('仅支持 PNG 格式的材质文件');
        return;
      }
      setFile(selectedFile);
      setError(null);
      // 自动从文件名提取名称（如果尚未填写）
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !name) {
      setError('请选择文件并填写材质名称');
      return;
    }

    if (isCustomUrl && !securityConfirmed) {
      setError('请先确认安全警告');
      return;
    }

    const token = getAuthToken();
    const uid = getUid();

    if (!token || !uid) {
      setError('请先登录');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const result = await uploadTexture({
        uid: parseInt(uid),
        type,
        model: type === 'skin' ? model : undefined,
        name,
        description,
        tags,
        file,
        remember_token: token,
      });

      if ('success' in result && result.success) {
        onSuccess();
        handleClose();
      } else {
        setError(result.message || '上传失败');
      }
    } catch (err) {
      setError('上传过程中发生错误');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setName('');
    setDescription('');
    setType('skin');
    setModel('default');
    setTags('');
    setError(null);
    setSecurityConfirmed(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>上传新材质</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadIcon />}
            fullWidth
            sx={{ py: 2 }}
          >
            {file ? `已选择: ${file.name}` : '点击上传 PNG 文件'}
            <input type="file" hidden accept="image/png" onChange={handleFileChange} />
          </Button>

          <TextField
            label="材质名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            size="small"
          />

          <FormControl>
            <FormLabel>材质类型</FormLabel>
            <RadioGroup
              row
              value={type}
              onChange={(e) => setType(e.target.value as TextureType)}
            >
              <FormControlLabel value="skin" control={<Radio />} label="皮肤" />
              <FormControlLabel value="cape" control={<Radio />} label="披风" />
            </RadioGroup>
          </FormControl>

          {type === 'skin' && (
            <FormControl>
              <FormLabel>皮肤模型</FormLabel>
              <RadioGroup
                row
                value={model}
                onChange={(e) => setModel(e.target.value as SkinModel)}
              >
                <FormControlLabel value="default" control={<Radio />} label="经典 (Steve)" />
                <FormControlLabel value="slim" control={<Radio />} label="苗条 (Alex)" />
              </RadioGroup>
            </FormControl>
          )}

          <TextField
            label="描述 (可选)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            size="small"
          />

          <TextField
            label="标签 (可选，逗号分隔)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            fullWidth
            size="small"
            placeholder="例如: 动漫, 帅气, 蓝色"
          />

          {isCustomUrl && (
            <Box sx={{ mt: 1, p: 2, border: '1px solid', borderColor: 'error.main', borderRadius: 1, bgcolor: 'rgba(211, 47, 47, 0.04)' }}>
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={securityConfirmed} 
                    onChange={(e) => setSecurityConfirmed(e.target.checked)} 
                    color="error"
                  />
                }
                label={
                  <Typography variant="body2" color="error.main" sx={{ fontWeight: 'bold' }}>
                    我已了解：向自定义材质源上传材质可能泄漏登录凭据。如果你无法理解这句话的含义，请立刻停止操作并清除自定义材质源后再上传材质。
                  </Typography>
                }
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>取消</Button>
        <Button 
          onClick={handleUpload} 
          variant="contained" 
          disabled={uploading || !file || !name || (isCustomUrl && !securityConfirmed)}
          color={isCustomUrl ? "error" : "primary"}
        >
          {uploading ? '上传中...' : '开始上传'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Skinlib: React.FC = () => {
  useMeta('skinlib');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textures, setTextures] = useState<TextureItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<TextureListRequest['type']>('all');
  const [order, setOrder] = useState<TextureListRequest['order']>('desc');
  const [tag, setTag] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState(SkinlibUrl);

  const fetchTextures = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTextures({
        type,
        order,
        tag: searchTag,
        page
      });

      if ('success' in result && result.success) {
        setTextures(result.data.items);
        setTotal(result.data.total);
      } else {
        setError(result.message || '获取材质列表失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTextures();
  }, [type, order, searchTag, page, sourceUrl]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTag(tag);
    setPage(1);
  };

  return (
    <Box sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            材质库
          </Typography>
          <Typography variant="body2" color="text.secondary">
            当前材质源: {sourceUrl || '(开发环境代理)'}
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <TextField
            size="small"
            label="材质源 URL"
            placeholder="http://example.com"
            value={sourceUrl}
            onChange={(e) => {
              const newUrl = e.target.value;
              setSourceUrl(newUrl);
              setSkinlibUrl(newUrl);
              setPage(1);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SettingsInputComponentIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ minWidth: 250 }}
          />
          <Button 
            variant="contained" 
            startIcon={<CloudUploadIcon />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            上传材质
          </Button>
        </Stack>
      </Box>

      {/* 筛选栏 */}

      <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>类型</InputLabel>
          <Select
            value={type}
            label="类型"
            onChange={(e) => {
              setType(e.target.value as any);
              setPage(1);
            }}
          >
            <MenuItem value="all">所有皮肤</MenuItem>
            <MenuItem value="default">经典 (Steve)</MenuItem>
            <MenuItem value="slim">苗条 (Alex)</MenuItem>
            <MenuItem value="cape">披风</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>排序</InputLabel>
          <Select
            value={order}
            label="排序"
            onChange={(e) => {
              setOrder(e.target.value as any);
              setPage(1);
            }}
          >
            <MenuItem value="desc">最新上传</MenuItem>
            <MenuItem value="asc">最早上传</MenuItem>
          </Select>
        </FormControl>

        <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', gap: 1, flexGrow: 1, maxWidth: 400 }}>
          <TextField
            size="small"
            placeholder="按标签搜索..."
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : textures.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            没有找到匹配的材质
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {textures.map((item) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.id}>
                <Card sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}>
                  <Box sx={{ 
                    position: 'relative', 
                    pt: item.type === 'skin' ? '150%' : '100%', // 皮肤预览通常较长
                    backgroundColor: 'grey.100',
                    overflow: 'hidden'
                  }}>
                    <CardMedia
                      component="img"
                      image={getPreviewUrl(item.preview_file)}
                      alt={item.name}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        p: 2,
                        imageRendering: 'pixelated' // 保持像素感
                      }}
                    />
                    <Chip 
                      label={item.type === 'skin' ? (item.model === 'slim' ? 'Alex' : 'Steve') : 'Cape'}
                      size="small"
                      color={item.type === 'skin' ? 'primary' : 'secondary'}
                      sx={{ position: 'absolute', top: 8, right: 8 }}
                    />
                  </Box>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="div" noWrap gutterBottom>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      height: '3em',
                      mb: 1
                    }}>
                      {item.description || '无描述'}
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {item.tags.split(/[，,；;\n]/).filter(t => t.trim()).slice(0, 3).map((t, idx) => (
                        <Chip key={idx} label={t.trim()} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Stack sx={{ mt: 6, alignItems: 'center' }}>
            <Pagination 
              count={Math.ceil(total / 16)} 
              page={page} 
              onChange={handlePageChange} 
              color="primary" 
              size="large"
            />
          </Stack>
        </>
      )}

      <UploadDialog 
        open={uploadDialogOpen} 
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={() => {
          fetchTextures();
          setPage(1);
        }}
      />
    </Box>
  );
};

export default Skinlib;
